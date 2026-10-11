// 섬 공유 상태: 누가 무엇을 주웠는지(claims), 바닥에 떨어진 것(drops), 가족 위치(presence)
import { db, ref, get, set, remove, onValue, off, runTransaction, serverTimestamp, onDisconnect, fpath, serverNow, rid } from "./fb.js";
import { roundOf, zoneOf } from "../domain/rounds.js";
import { state } from "../state.js";

// ---- 구역 구독 ----
const claims = new Map();   // zone → {pid: claim}
const drops = new Map();    // zone → {dropId: drop}
const unsubs = new Map();   // key → off 함수
let curRound = null;
const listeners = new Set();
export const onWorld = f => { listeners.add(f); return () => listeners.delete(f); };
const tell = () => listeners.forEach(f => f());

export const today = () => roundOf(serverNow());
export const watchedRound = () => curRound;
export const isTaken = (zone, pid) => !!(claims.get(zone) || {})[pid];
export const dropsIn = zone => drops.get(zone) || {};

// 내 위치 주변(3×3 구역)만 받는다
export function watchAround(tx, ty) {
  const r = today();
  if (r !== curRound) { for (const u of unsubs.values()) u(); unsubs.clear(); claims.clear(); drops.clear(); curRound = r; }
  const want = new Set();
  const zx = Math.floor(tx / 16), zy = Math.floor(ty / 16);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) want.add(`z${zx + dx}_${zy + dy}`);
  for (const [k, u] of unsubs) if (!want.has(k.slice(2))) { u(); unsubs.delete(k); }
  for (const z of want) {
    if (!unsubs.has("c:" + z)) unsubs.set("c:" + z, onValue(ref(db, fpath(state.fid, "claims", r, z)), s => { claims.set(z, s.val() || {}); tell(); }, () => {}));
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
  const rounds = [roundOf(now), roundOf(now - 24 * 3600 * 1000)];
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
let presRef = null, presPlace = null, lastSent = 0, lastPos = null;
const others = new Map();  // ses → {m,x,y,d,t}
let presUnsub = null;
export const othersHere = () => others;

export function enterPlace(place) {
  if (presRef) { remove(presRef).catch(() => {}); }
  if (presUnsub) presUnsub();
  others.clear();
  presPlace = place;
  presRef = ref(db, fpath(state.fid, "presence", place, state.ses));
  onDisconnect(presRef).remove();
  presUnsub = onValue(ref(db, fpath(state.fid, "presence", place)), s => {
    const all = s.val() || {};
    const seen = new Set();
    for (const [ses, v] of Object.entries(all)) {
      if (ses === state.ses || !v || v.m === state.mid) continue;
      // 옛 기기·꺼진 앱의 흔적은 빼기: 그 사람의 현재 세션만, 10분 넘게 소식 없으면 숨김
      const cur = state.members[v.m];
      if (!cur || cur.ses !== ses || (typeof v.t === "number" && serverNow() - v.t > 10 * 60 * 1000)) continue;
      seen.add(ses);
      const o = others.get(ses);
      if (o) { o.tx = v.x; o.ty = v.y; o.d = v.d; o.m = v.m; }
      else others.set(ses, { m: v.m, x: v.x, y: v.y, tx: v.x, ty: v.y, d: v.d, walk: 0 });
    }
    for (const k of [...others.keys()]) if (!seen.has(k)) others.delete(k);
  }, () => {});
  lastPos = null;
}

export function sendPos(x, y, d, force) {
  if (!presRef) return;
  const now = performance.now();
  if (!force && now - lastSent < 250) return;
  if (!force && now - lastSent < 60000 && lastPos && Math.abs(lastPos.x - x) < 0.01 && Math.abs(lastPos.y - y) < 0.01 && lastPos.d === d) return;
  lastSent = now; lastPos = { x, y, d };
  set(presRef, { m: state.mid, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, d, t: serverTimestamp() }).catch(() => {});
}

export function leavePresence() { if (presRef) remove(presRef).catch(() => {}); presRef = null; }
