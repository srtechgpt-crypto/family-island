// 버전 8 오늘의 부탁 게시판: requests/{오늘}(가족 공유)·reqMine/{나}(받을 물건)
// 들어주기·받기는 묶음 쓰기(update) 한 번씩 — 규칙이 가방 증감·도장·rev를 함께 검사한다. 계약: docs/데이터구조.md "버전 8"
import { db, ref, get, set, update, remove, onValue, off, serverTimestamp, fpath, rid, onConnection } from "./fb.js";
import * as P from "./playerStore.js";
import * as W from "./worldStore.js";
import { newRequest, freeSlot, helpPatch, receivePatch, validRequest } from "../domain/requests.js";
import { state, onState } from "../state.js";

let reqs = {}, day = null, dayRef = null, mine = {}, started = false, cfg = null, items = null, loaded = false;
const listeners = new Set();
export const onRequests = f => { listeners.add(f); return () => listeners.delete(f); };
const emit = e => listeners.forEach(f => f(e));
export const today = () => reqs;
export const todayKey = () => day;
export const ready = () => loaded;
export const incoming = () => mine;

// 오늘 부탁 목록(검사 통과한 것만), 오래된 순
export function list() {
  return Object.entries(reqs).filter(([id, r]) => validRequest(r, id)).map(([, r]) => r).sort((a, b) => a.at - b.at);
}

function watchDay() {
  const d = W.today();
  if (d === day) return;
  if (dayRef) off(dayRef);
  day = d; reqs = {}; loaded = false;
  dayRef = ref(db, fpath(state.fid, "requests", d));
  onValue(dayRef, s => { reqs = s.val() || {}; loaded = true; emit({}); }, () => { loaded = false; });
}

export function startRequests(boardCfg, itemTable) {
  cfg = boardCfg; items = itemTable;
  if (started) return;
  started = true;
  watchDay();
  onValue(ref(db, fpath(state.fid, "reqMine", state.mid)), s => { mine = s.val() || {}; emit({}); receiveAll().catch(() => {}); }, () => {});
  onConnection(c => { if (c) receiveAll().catch(() => {}); });
  onState(w => { if (w === "player" && Object.keys(mine).length) receiveAll().catch(() => {}); });   // 내 데이터가 새로 오면(rev 갱신) 다시
  setInterval(() => { watchDay(); receiveAll().catch(() => {}); }, 30000);
}

// ---- 올리기·지우기 ----
export async function post(item, qty) {
  watchDay();
  const slot = freeSlot(reqs, state.mid, cfg.perPerson);
  const r = newRequest(rid(10), state.mid, item, qty, slot, items, cfg);
  if (!r.ok) return r;
  try { await set(ref(db, fpath(state.fid, "requests", day, r.body.id)), { ...r.body, at: serverTimestamp(), ses: state.ses }); return { ok: true }; }
  catch { return { ok: false, reason: "올리지 못했어요. 연결을 확인해 주세요" }; }
}
export async function cancel(id) {
  try { await remove(ref(db, fpath(state.fid, "requests", day, id))); return { ok: true }; }
  catch { return { ok: false, reason: "벌써 누가 들어줬거나 지울 수 없어요" }; }
}

// ---- 들어주기: 실패하면 물건은 한 번도 빠지지 않는다(통째로 거절). 내 데이터가 그사이 바뀐 거면 새로 읽고 다시 ----
let helping = false;
export const isHelping = () => helping;
export async function help(id) {
  if (helping) return { ok: false, reason: "잠깐만요" };
  helping = true;
  try {
    const d = day;
    let player = state.player, req = reqs[id];
    for (let i = 0; i < 3; i++) {
      const r = helpPatch(player, state.mid, d, req, serverTimestamp());
      if (!r.ok) return r;
      try { await update(ref(db, fpath(state.fid)), r.patch); return { ok: true, req }; }
      catch {
        // 거절: 서버 값을 다시 읽어 왜인지 본다(누가 먼저 / 내 가방이 그사이 바뀜)
        try {
          req = (await get(ref(db, fpath(state.fid, "requests", d, id)))).val();
          player = P.norm((await get(ref(db, fpath(state.fid, "players", state.mid)))).val());
        } catch { return { ok: false, reason: "연결을 확인해 주세요" }; }
        if (!req) return { ok: false, reason: "부탁이 지워졌어요" };
        if (req.done) return { ok: false, reason: req.done.by === state.mid ? "벌써 들어줬어요" : "앗, 가족이 먼저 들어줬어요" };
      }
    }
    return { ok: false, reason: "지금은 들어줄 수 없어요. 잠시 뒤에 다시 해요" };
  } finally { helping = false; }
}

// ---- 받기: 받을 줄마다 묶음 쓰기 한 번. 실패하면 줄이 남아 30초 뒤·재연결 때 다시 ----
const receiving = new Set();
async function receiveAll() {
  for (const [id, rec] of Object.entries(mine)) {
    if (receiving.has(id) || !state.player) continue;
    receiving.add(id);
    try {
      const r = receivePatch(state.player, state.mid, id, rec);
      if (!r.ok) continue;
      await update(ref(db, fpath(state.fid)), r.patch);
      if (!r.already) emit({ got: { ...rec, id } });
    } catch { /* rev가 그사이 바뀜 등 — 다음에 다시 */ }
    finally { receiving.delete(id); }
  }
}
