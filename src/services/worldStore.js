// 섬 공유 상태: 누가 무엇을 주웠는지(claims), 바닥에 떨어진 것(drops), 가족 위치(presence)
import { db, ref, get, set, update, remove, onValue, off, runTransaction, serverTimestamp, onDisconnect, fpath, serverNow, rid } from "./fb.js";
import { gatherKey, gatherClaimId } from "../domain/gather.js";
import { roundOf, zoneOf } from "../domain/rounds.js";
import { state } from "../state.js";

// ---- 구역 구독 ----
const claims = new Map();   // zone → {pid: claim}  (하루 주기: 조개·돌·나뭇가지·벌집)
const gclaims = new Map();  // zone → {id: claim}   (v4 30분 주기: 밭·버섯·약초·꽃·잡초·열매)
let curGKey = null;
const drops = new Map();    // zone → {dropId: drop}
const unsubs = new Map();   // key → off 함수
let curRound = null;
const listeners = new Set();
export const onWorld = f => { listeners.add(f); return () => listeners.delete(f); };
const tell = () => listeners.forEach(f => f());

export const today = () => roundOf(serverNow());
export const watchedRound = () => curRound;
export const isTaken = (zone, pid) => !!(claims.get(zone) || {})[pid];
export const gnow = () => gatherKey(serverNow());
export const watchedGKey = () => curGKey;
export const isGTaken = (zone, id) => !!(gclaims.get(zone) || {})[id];
export const dropsIn = zone => drops.get(zone) || {};

// 내 위치 주변(3×3 구역)만 받는다
export function watchAround(tx, ty) {
  const r = today();
  const gk = gnow();
  if (r !== curRound || gk !== curGKey) { for (const u of unsubs.values()) u(); unsubs.clear(); claims.clear(); drops.clear(); gclaims.clear(); curRound = r; curGKey = gk; }
  const want = new Set();
  const zx = Math.floor(tx / 16), zy = Math.floor(ty / 16);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) want.add(`z${zx + dx}_${zy + dy}`);
  for (const [k, u] of unsubs) if (!want.has(k.slice(2))) { u(); unsubs.delete(k); }
  for (const z of want) {
    if (!unsubs.has("c:" + z)) unsubs.set("c:" + z, onValue(ref(db, fpath(state.fid, "claims", r, z)), s => { claims.set(z, s.val() || {}); tell(); }, () => {}));
    if (!unsubs.has("g:" + z)) unsubs.set("g:" + z, onValue(ref(db, fpath(state.fid, "gather", gk, z)), s => { gclaims.set(z, s.val() || {}); tell(); }, () => {}));
    if (!unsubs.has("d:" + z)) unsubs.set("d:" + z, onValue(ref(db, fpath(state.fid, "drops", z)), s => {
      const all = s.val() || {}; const keep = {};
      for (const [k, v] of Object.entries(all)) if (v.round === r) keep[k] = v;
      drops.set(z, keep); tell();
    }, () => {}));
  }
}

// 줍기 확정: 없을 때만 내 이름으로 생성. 성공하면 claim 객체.
export async function claim(zone, pid, item, qty) {
  const r = today();
  const at = ref(db, fpath(state.fid, "claims", r, zone, pid));
  let mine = null;
  const res = await runTransaction(at, cur => {
    if (cur) return;                      // 이미 누가 가져감
    mine = { by: state.mid, item, qty, at: serverTimestamp() };
    return mine;
  }, { applyLocally: false });
  if (!res.committed) return { ok: false, reason: res.snapshot.exists() && res.snapshot.val().by !== state.mid ? "먼저" : "실패" };
  const v = res.snapshot.val();
  return { ok: true, claim: { id: `c_${r}_${zone}_${pid}`, by: v.by, item: v.item, qty: v.qty, at: v.at } };
}

// v4 30분 채집: 화면에서 고른 대상의 회차 키를 그대로 씀(경계를 넘었으면 서버가 거절 → 자동 재시도 안 함).
// 공유 기록 + 내 복구 목록(gatherMine)을 한 번의 update로 만들고, 실제 기록을 다시 읽어 지급용 claim을 돌려준다.
export async function claimGather(t, item, qty) {
  const id = gatherClaimId(t.key, t.zone, t.id);
  const path = fpath(state.fid, "gather", t.key, t.zone, t.id);
  try {
    await update(ref(db, fpath(state.fid)), {
      [`gather/${t.key}/${t.zone}/${t.id}`]: { by: state.mid, item, qty, at: serverTimestamp(), ses: state.ses },
      [`gatherMine/${state.mid}/${id}`]: serverTimestamp(),
    });
  } catch {
    let cur = null; try { cur = (await get(ref(db, path))).val(); } catch { /* 무시 */ }
    if (cur && cur.by !== state.mid) return { ok: false, reason: "먼저" };
    if (!cur && t.key !== gnow()) return { ok: false, reason: "새회차" };
    if (!cur) return { ok: false, reason: "실패" };
  }
  const v = (await get(ref(db, path))).val();
  if (!v || v.by !== state.mid) return { ok: false, reason: "먼저" };
  return { ok: true, claim: { id, by: v.by, item: v.item, qty: v.qty, at: v.at } };
}
export const dropMine = id => remove(ref(db, fpath(state.fid, "gatherMine", state.mid, id))).catch(() => {});
export async function myGatherMine() { return (await get(ref(db, fpath(state.fid, "gatherMine", state.mid)))).val() || {}; }
export async function readGather(claimId) {
  const m = /^g_(h[1-9][0-9]{7})_(z[0-9]+_[0-9]+)_([A-Za-z0-9_-]+)$/.exec(claimId); if (!m) return null;
  const v = (await get(ref(db, fpath(state.fid, "gather", m[1], m[2], m[3])))).val();
  return v ? { id: claimId, by: v.by, item: v.item, qty: v.qty, at: v.at } : null;
}

// 나무를 흔들면 과일이 바닥에 떨어진다(가족 누구나 주울 수 있음). spots: 떨어질 칸 [{x,y}]
export async function dropItems(spots, item) {
  const r = today();
  const out = [];
  for (const { x, y } of spots) {
    const id = "d" + rid(8);
    const z = zoneOf(x, y);
    await set(ref(db, fpath(state.fid, "drops", z, id)), { item, x, y, round: r, at: serverTimestamp(), by: state.mid });
    out.push({ id, z, x, y });
  }
  return out;
}

// 재접속: 오늘·어제 회차의 내 claim 중 아직 안 받은 것
export async function myRecentClaims() {
  const now = serverNow();
  // 최근 14회차(앱을 며칠 안 켜도 줍던 중 꺼진 물건을 받음)
  const rounds = Array.from({ length: 14 }, (_, i) => roundOf(now - i * 24 * 3600 * 1000));
  const out = [];
  for (const r of rounds) {
    let all = null;
    try { all = (await get(ref(db, fpath(state.fid, "claims", r)))).val(); } catch { all = null; }
    if (!all) continue;
    for (const [z, pids] of Object.entries(all)) for (const [pid, c] of Object.entries(pids))
      if (c.by === state.mid) out.push({ id: `c_${r}_${z}_${pid}`, by: c.by, item: c.item, qty: c.qty, at: c.at });
  }
  return out;
}

// ---- 가족 위치 ----
// 가족 위치 전체(presence/*)를 한 번만 받아 두고, 게임 화면(지금 있는 곳)과 미니맵(모두)이 나눠 쓴다
let presRef = null, presPlace = null, lastSent = 0, lastPos = null, presAllUnsub = null;
let presenceAll = {};
const others = new Map();  // 지금 있는 곳의 다른 가족: ses → {m,x,y,tx,ty,d,walk}
export const othersHere = () => others;
export const allPresence = () => presenceAll;

function syncOthers() {
  const here = presenceAll[presPlace] || {};
  const seen = new Set();
  for (const [ses, v] of Object.entries(here)) {
    if (ses === state.ses || !v || v.m === state.mid) continue;
    // 옛 기기·꺼진 앱의 흔적은 빼기: 그 사람의 현재 세션만, 10분 넘게 소식 없으면 숨김
    const cur = state.members[v.m];
    if (!cur || cur.ses !== ses || (typeof v.t === "number" && serverNow() - v.t > 10 * 60 * 1000)) continue;
    seen.add(ses);
    const o = others.get(ses);
    const mode = v.mode === "boat" ? "boat" : "walk";
    if (o) { if (o.mode !== mode) { o.x = v.x; o.y = v.y; } o.tx = v.x; o.ty = v.y; o.d = v.d; o.m = v.m; o.mode = mode; }
    else others.set(ses, { m: v.m, x: v.x, y: v.y, tx: v.x, ty: v.y, d: v.d, walk: 0, mode });
  }
  for (const k of [...others.keys()]) if (!seen.has(k)) others.delete(k);
}

export function enterPlace(place) {
  if (presRef) { onDisconnect(presRef).cancel().catch(() => {}); remove(presRef).catch(() => {}); }
  others.clear();
  presPlace = place;
  presRef = ref(db, fpath(state.fid, "presence", place, state.ses));
  onDisconnect(presRef).remove();
  if (!presAllUnsub) presAllUnsub = onValue(ref(db, fpath(state.fid, "presence")), s => { presenceAll = s.val() || {}; syncOthers(); }, () => {});
  else syncOthers();
  lastPos = null;
}
export const currentPlace = () => presPlace;
// 다시 연결될 때마다 '끊기면 내 위치 지우기'를 다시 걸어 둔다(서버는 한 번 끊기면 예약을 잊음)
onValue(ref(db, ".info/connected"), s => { if (s.val() === true && presRef) onDisconnect(presRef).remove().catch(() => {}); });

// beatMs: 멈춰 있어도 이 간격마다 갱신(캠프 근처는 10초 — 모인 사람 판정)
// mode: "walk" | "boat"(v4 뱃놀이). 승하선은 force로 바로 보낸다
export function sendPos(x, y, d, force, beatMs = 60000, mode = "walk") {
  if (!presRef) return;
  const now = performance.now();
  if (!force && now - lastSent < 250) return;
  if (!force && now - lastSent < beatMs && lastPos && Math.abs(lastPos.x - x) < 0.01 && Math.abs(lastPos.y - y) < 0.01 && lastPos.d === d && lastPos.mode === mode) return;
  const val = { m: state.mid, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, d, t: serverTimestamp() };
  if (mode === "boat") val.mode = "boat";
  lastSent = now;
  return set(presRef, val).then(() => { lastPos = { x, y, d, mode }; }).catch(e => { lastPos = null; throw e; });
}

export function leavePresence() { if (presRef) remove(presRef).catch(() => {}); presRef = null; }
