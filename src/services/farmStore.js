// 버전 7 목장: 텃밭(farm, 가족 공유)·수확 기록(farmMine, 심은 사람에게)·애완동물(members/{mid}/pet)
// 규칙과 계약: docs/데이터구조.md "버전 7 목장"
import { db, ref, get, set, update, onValue, serverTimestamp, fpath, rid, onConnection, serverNow } from "./fb.js";
import * as P from "./playerStore.js";
import { reservePlant, settlePlant, harvestRecord, farmClaim, waterSlot } from "../domain/farm.js";
import { applyClaim } from "../domain/rewards.js";
import { state } from "../state.js";

let farm = {}, loaded = false, mine = {}, started = false, cfg = null;
const listeners = new Set();
export const onFarm = f => { listeners.add(f); return () => listeners.delete(f); };
export const plots = () => farm;
export const ready = () => loaded;            // 첫 텃밭 값을 받은 뒤에만 심기·물·거두기(⑦ 지적)

export function startFarm(farmCfg) {
  cfg = farmCfg;
  if (started) return;
  started = true;
  onValue(ref(db, fpath(state.fid, "farm")), s => { farm = s.val() || {}; loaded = true; listeners.forEach(f => f()); }, () => { loaded = false; });
  onValue(ref(db, fpath(state.fid, "farmMine", state.mid)), s => { mine = s.val() || {}; grantMine().catch(() => {}); }, () => {});
  // 앱 시작·다시 연결될 때 끝나지 않은 심기 예약 정리, 실패한 지급·정리는 30초마다 다시(⑦ 지적)
  onConnection(c => { if (c) { recoverPend().catch(() => {}); grantMine().catch(() => {}); } });
  setInterval(() => { recoverPend().catch(() => {}); grantMine().catch(() => {}); }, 30000);
}

// ---- 심기: 예약(씨앗 빼기) → 칸 만들기 → 예약 정리 ----
let planting = false;
export async function plant(plotId, crop) {
  if (planting) return { ok: false, reason: "잠깐만요" };
  planting = true;
  try {
    const plantId = rid(10);
    const r = await P.farmTx(p => reservePlant(p, plantId, plotId, crop, cfg));
    if (!r.ok) return r;
    let planted = false;
    try {
      await set(ref(db, fpath(state.fid, "farm", plotId)), { id: plantId, by: state.mid, crop, at: serverTimestamp(), ses: state.ses });
      planted = true;
    } catch {
      // 거절됐어도 실제로는 들어갔을 수 있으니(응답만 잃음) 서버 값을 다시 본다
      try { planted = await plantedProof(plotId, plantId); } catch { return { ok: false, reason: "연결을 확인해 주세요" }; }
    }
    const s = await P.farmTx(p => settlePlant(p, plantId, planted, cfg));
    if (!planted) return { ok: false, reason: s.ok ? "앗, 가족이 먼저 심었어요" : "연결을 확인해 주세요" };
    return { ok: true };
  } finally { planting = false; }
}

// 이 작물이 실제로 심겼다는 증거: 칸에 아직 있음 / 이미 거둬져 내 수확 기록이 있음 / 이미 받았음(f_ 표식)
async function plantedProof(plotId, plantId) {
  if (state.player && state.player.applied && state.player.applied["f_" + plantId]) return true;
  const v = (await get(ref(db, fpath(state.fid, "farm", plotId)))).val();
  if (v && v.id === plantId) return true;
  return (await get(ref(db, fpath(state.fid, "farmMine", state.mid, plantId)))).exists();
}

// 앱 시작·재연결·30초마다: 남은 예약마다 증거를 보고 심겼으면 정리, 아니면 씨앗 돌려주기
let recovering = false;
export async function recoverPend() {
  if (recovering || planting || !state.player) return;
  const pend = Object.entries(state.player.farmPend || {});
  if (!pend.length) return;
  recovering = true;
  try {
    for (const [plantId, p] of pend) {
      let planted;
      try { planted = await plantedProof(p.plot, plantId); } catch { return; }   // 못 읽으면 다음에
      await P.farmTx(pl => settlePlant(pl, plantId, planted, cfg)).catch(() => {});
    }
  } finally { recovering = false; }
}

// ---- 물 주기: 다 자라기 전, w1 누구나 / w2는 다른 가족 ----
export async function water(plotId, nowMs) {
  const v = farm[plotId];
  const w = waterSlot(v, cfg, state.mid, nowMs);
  if (!w.ok) return w;
  try { await set(ref(db, fpath(state.fid, "farm", plotId, w.slot)), { by: state.mid, at: serverTimestamp() }); return { ok: true, slot: w.slot }; }
  catch { return { ok: false, reason: "지금은 물을 줄 수 없어요" }; }
}

// ---- 수확: 누구나, 칸 지우기 + 심은 사람 farmMine을 한 번에 ----
// 내 작물이면 서버가 받아들이기 전의 내 화면 값(낙관적 반영)으로 지급하지 않도록 그동안 잠가 둔다(⑦ 지적)
const unconfirmed = new Set();
export async function harvest(plotId) {
  const v = farm[plotId];
  const rec = harvestRecord(v, cfg, plotId);
  if (!rec) return { ok: false, reason: "없는 작물" };
  unconfirmed.add(rec.id);
  try {
    await update(ref(db, fpath(state.fid)), {
      [`farm/${plotId}`]: null,
      [`farmMine/${rec.owner}/${rec.id}`]: { item: rec.item, qty: rec.qty, at: serverTimestamp(), plot: plotId },
    });
    return { ok: true, rec };
  } catch { return { ok: false, reason: "조금만 더 기다려요" }; }
  finally { unconfirmed.delete(rec.id); grantMine().catch(() => {}); }
}

// ---- 내 수확 기록 받기: 개인 트랜잭션이 서버에 저장된 뒤에만 줄을 지운다 ----
const granting = new Set();
async function grantMine() {
  for (const [plantId, rec] of Object.entries(mine)) {
    if (granting.has(plantId) || unconfirmed.has(plantId)) continue;
    const c = farmClaim(plantId, state.mid, rec);
    if (!c) continue;
    granting.add(plantId);
    try {
      const r = await P.farmTx(p => applyClaim(p, c, state.mid, Math.max(serverNow(), c.at)));
      if (r.ok) {
        if (r.changed !== false) listeners.forEach(f => f({ got: rec }));
        await set(ref(db, fpath(state.fid, "farmMine", state.mid, plantId)), null).catch(() => {});
      }
    } catch { /* 30초 뒤·재연결 때 다시 */ }
    finally { granting.delete(plantId); }
  }
}

// ---- 애완동물 ----
export const savePet = (kind, name) => set(ref(db, fpath(state.fid, "members", state.mid, "pet")), { kind, name, ses: state.ses });
