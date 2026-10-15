// 버전 11 섬 발전: isle/give(가족 공유, 사람별 누적) 구독 · 재료 넣기(묶음 쓰기 한 번) · 기념 가구 지급(개인 트랜잭션)
// 계약: docs/데이터구조.md "버전 11"
import { db, ref, get, update, onValue, fpath } from "./fb.js";
import * as P from "./playerStore.js";
import { donatePatch, builtSet, payIsle, rewardKey } from "../domain/isle.js";
import { state, onState } from "../state.js";

// gives = 화면에 쓰는 '확정' 값. 내 넣기가 서버 확인을 기다리는 동안 온 값(내 쓰기의 낙관적 반영일 수 있음)은
// held에 두었다가 확인이 끝난 뒤 적용 → 거절될 쓰기로 다리가 잠깐 열리거나 기념 가구가 나가는 일이 없다(⑤ 반영)
let gives = {}, held, loaded = false, started = false, cfg = null, busy = false;
const listeners = new Set();
export const onIsle = f => { listeners.add(f); return () => listeners.delete(f); };
const emit = e => listeners.forEach(f => f(e));
export const isleGives = () => gives;
export const isleReady = () => loaded;
export const built = () => (cfg ? builtSet(gives, cfg) : new Set());
function accept(v) { gives = v || {}; loaded = true; emit({}); payAll().catch(() => {}); }

export function startIsle(isleCfg) {
  cfg = isleCfg;
  if (started) return;
  started = true;
  onValue(ref(db, fpath(state.fid, "isle", "give")), s => { if (busy) held = s.val(); else accept(s.val()); }, () => {});
  onState(w => { if (w === "player" && loaded) payAll().catch(() => {}); });
  setInterval(() => { if (loaded) payAll().catch(() => {}); }, 30000);   // 지급이 실패했으면 다시
}

// ---- 넣기: 결과 불명이면 내 누적값을 읽어 이미 들어갔는지 먼저 확인(두 번 내지 않게). 거절이면 최신 값으로 다시(최대 3번) ----
export const isDonating = () => busy;
export async function donate(pid, item, want) {
  if (busy) return { ok: false, reason: "잠깐만요" };
  busy = true; held = undefined;
  try {
    let player = state.player, g = gives;
    for (let i = 0; i < 3; i++) {
      const r = donatePatch(player, state.mid, g, cfg, pid, item, want);
      if (!r.ok) return r;
      const target = r.patch[`isle/give/${pid}/${state.mid}/${item}`];
      try { await update(ref(db, fpath(state.fid)), r.patch); return { ok: true, q: r.q }; }
      catch {
        try {
          g = (await get(ref(db, fpath(state.fid, "isle", "give")))).val() || {};
          player = P.norm((await get(ref(db, fpath(state.fid, "players", state.mid)))).val());
        } catch { return { ok: false, reason: "연결을 확인해 주세요" }; }
        // 내 칸은 나(현재 세션)만 늘리므로 목표값 이상이면 방금 쓰기가 이미 들어간 것
        const now = g?.[pid]?.[state.mid]?.[item];
        if (Number.isSafeInteger(now) && now >= target) return { ok: true, q: r.q };
      }
    }
    return { ok: false, reason: "지금은 넣을 수 없어요. 잠시 뒤에 다시 해요" };
  } finally {
    busy = false;
    if (held !== undefined) { const v = held; held = undefined; accept(v); }
    else get(ref(db, fpath(state.fid, "isle", "give"))).then(s => accept(s.val())).catch(() => {});
  }
}

// ---- 기념 가구: 확정 완성된 공사마다 한 번(done i_{pid}). 이 폰에서 새로 받은 것만 축하 ----
let paying = false;
async function payAll() {
  if (paying || busy || !state.player || !cfg) return;
  paying = true;
  try {
    const b = builtSet(gives, cfg);
    for (const p of cfg.projects) {
      if (!b.has(p.id)) break;
      if (state.player.done && state.player.done[rewardKey(p.id)] === true) continue;
      const r = await P.isleTx(pl => payIsle(pl, p)).catch(() => ({ ok: false }));
      if (r && r.ok && r.changed !== false) emit({ done: p });
    }
  } finally { paying = false; }
}
