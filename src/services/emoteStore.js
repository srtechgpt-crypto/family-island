// 감정 표현: emotes/{장소}/{세션}에 최신 하나. 시간은 서버 기준.
import { db, ref, set, remove, onValue, onDisconnect, serverTimestamp, fpath, rid, isConnected, serverNow } from "./fb.js";
import { state } from "../state.js";

let myRef = null, unsub = null, here = {}, turn = 0;
export const emotesHere = () => here;   // ses → {m, kind, at, id}

export async function enterEmotePlace(place) {
  const my = ++turn;   // 기다리는 사이 다른 곳으로 옮기면 옛 요청은 버린다
  if (myRef) { onDisconnect(myRef).cancel().catch(() => {}); remove(myRef).catch(() => {}); }
  if (unsub) { unsub(); unsub = null; }
  here = {};
  const r = ref(db, fpath(state.fid, "emotes", place, state.ses));
  myRef = r;
  try { await onDisconnect(r).remove(); } catch { /* 연결되면 다시 */ }
  if (my !== turn) { onDisconnect(r).cancel().catch(() => {}); return; }
  unsub = onValue(ref(db, fpath(state.fid, "emotes", place)), s => { if (my === turn) here = s.val() || {}; }, () => {});
}

let last = 0, sending = false;
export async function sendEmote(kind) {
  if (sending) return { ok: false, reason: "busy" };
  if (!myRef || !isConnected()) return { ok: false, reason: "연결 없음" };
  if (performance.now() - last < 800) return { ok: false, reason: "잠깐만" };
  last = performance.now();
  sending = true;
  // 보내는 중 연결이 끊기면 set이 다시 연결될 때까지 안 끝나므로, 3초 뒤엔 잠금만 푼다
  try {
    const ok = await Promise.race([set(myRef, { m: state.mid, kind, id: rid(8), at: serverTimestamp() }).then(() => true), new Promise(r => setTimeout(() => r(false), 3000))]);
    return ok ? { ok: true } : { ok: false, reason: "보내지 못함" };
  }
  catch { return { ok: false, reason: "보내지 못함" }; }
  finally { sending = false; }
}
export { serverNow };
