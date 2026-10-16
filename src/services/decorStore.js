// 버전 12 저장: 하트(hearts/{주인}/{보낸사람}), 이 주의 꾸미기 대회(contest/w{주}/entry·vote), 마당을 그리기 위한 가족 데이터 구독
import { db, ref, onValue, runTransaction, set, get, fpath, serverNow, serverTimestamp } from "./fb.js";
import { state } from "../state.js";
import { heartNext, kstDay, kstWeek, weekKey } from "../domain/decor.js";
import { norm } from "./playerStore.js";

const MIDS = ["m0", "m1", "m2", "m3", "m4", "m5"];
let hearts = {}, contest = {}, players = {};
const subs = new Set();
const tell = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };
export const onDecor = f => { subs.add(f); return () => subs.delete(f); };

let started = false, wkWatched = null, wkUnsub = [];
export function startDecor() {
  if (started) return; started = true;
  onValue(ref(db, fpath(state.fid, "hearts")), s => { hearts = s.val() || {}; tell(); }, () => {});
  // 마당은 모든 가족 것이 섬에 보여야 함 → 다른 가족 players 구독(내 것은 state.player)
  for (const m of MIDS) if (m !== state.mid) onValue(ref(db, fpath(state.fid, "players", m)), s => { try { players[m] = s.val() ? norm(s.val()) : null; } catch { players[m] = null; } tell(); }, () => {});
  watchWeeks();
  setInterval(watchWeeks, 60000);
}
// 이번 주·지난주 대회만 구독(주가 바뀌면 다시)
function watchWeeks() {
  const wk = kstWeek(serverNow());
  if (wk === wkWatched) return;
  wkWatched = wk; for (const u of wkUnsub) u(); wkUnsub = []; contest = {};
  for (const w of [wk, wk - 1]) wkUnsub.push(onValue(ref(db, fpath(state.fid, "contest", weekKey(w))), s => { contest[weekKey(w)] = s.val() || {}; tell(); }, () => {}));
}
export const playerOf = mid => mid === state.mid ? state.player : players[mid] || null;
export const heartsOf = owner => hearts[owner] || {};
export const myHeartTo = owner => (hearts[owner] || {})[state.mid] || null;
export const contestOf = wk => contest[weekKey(wk)] || {};
export const thisWeek = () => kstWeek(serverNow());

// 하트: 트랜잭션으로 n+1(하루 한 번). 서버가 받아들여야 성공
export async function sendHeart(owner) {
  const day = kstDay(serverNow());
  let out = null;
  const r = await runTransaction(ref(db, fpath(state.fid, "hearts", owner, state.mid)), cur => { const nx = heartNext(cur, day); out = nx; return nx || undefined; }, { applyLocally: false });
  if (!out) return { ok: false, reason: "오늘은 벌써 눌렀어요" };
  return r.committed ? { ok: true } : { ok: false, reason: "저장 실패" };
}
export async function enterContest(room) {
  const wk = thisWeek();
  await set(ref(db, fpath(state.fid, "contest", weekKey(wk), "entry", state.mid)), { room, wk, at: serverTimestamp() });
}
export async function vote(to) {
  const wk = thisWeek();
  await set(ref(db, fpath(state.fid, "contest", weekKey(wk), "vote", state.mid)), { to, wk });
}
// 지난주 대회 결과를 서버에서 다시 읽기(마감 후라 바뀌지 않음)
export async function fetchContest(wk) {
  if (wk >= thisWeek()) throw new Error("아직 이번 주");
  return (await get(ref(db, fpath(state.fid, "contest", weekKey(wk))))).val() || {};
}
// 투표 기록 {voter: {to,wk}} → {voter: to}
export const votesOf = c => Object.fromEntries(Object.entries((c && c.vote) || {}).map(([v, x]) => [v, x && x.to]));
