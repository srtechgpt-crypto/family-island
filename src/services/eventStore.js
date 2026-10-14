// 버전 10 이벤트 저장: 캠프 보물찾기(campfires/{day}/hunt + huntMine) · 생일(members/bday, bday/{day}/{주인공}/cards)
// 계약: docs/데이터구조.md "버전 10"
import { db, ref, get, set, update, remove, onValue, serverTimestamp, fpath, rid, serverNow } from "./fb.js";
import { kstDay } from "../domain/campfire.js";
import { bdayOnDays, kstDate } from "../domain/bday.js";
import { state, emit } from "../state.js";

const fp = (...p) => fpath(state.fid, ...p);

// ---- 보물찾기 ----
let hDay = null, hUnsub = null;
export const huntDay = () => hDay;
// 오늘 판 구독(날이 바뀌면 다시) → state.hunt
export function watchHuntToday() {
  const d = kstDay(serverNow());
  if (d === hDay && hUnsub) return;
  if (hUnsub) hUnsub();
  hDay = d; state.hunt = null;
  hUnsub = onValue(ref(db, fp("campfires", String(d), "hunt")), s => { state.hunt = s.val(); emit("hunt"); }, () => {});
}
// 새 판: id·n·자리를 미리 정해 한 번에 씀(규칙: 이전 판이 끝났을 때만, n = 이전+1). 응답을 못 받으면 서버 값을 읽어 내 것인지 확인
export async function startHunt(prevN, spots, withMid) {
  const id = "h_" + rid(8), day = hDay;
  const body = { id, n: prevN + 1, by: state.mid, ses: state.ses, with: withMid, at: serverTimestamp(), spots: Object.fromEntries(spots.map((s, i) => [i, { x: s.x, y: s.y }])) };
  try { await set(ref(db, fp("campfires", String(day), "hunt")), body); return { ok: true }; }
  catch {
    const v = (await get(ref(db, fp("campfires", String(day), "hunt"))).catch(() => null))?.val?.();
    return { ok: !!(v && v.id === id) };
  }
}
// 보물 열기: found/{i}와 내 받을 줄 huntMine을 update 한 번으로(규칙이 둘을 서로 확인). 결과 "mine" | "taken" | "fail"
export async function openTreasure(day, n, i, reward) {
  const req = "o_" + rid(8);
  try {
    await update(ref(db, fp()), {
      [`campfires/${day}/hunt/found/${i}`]: { by: state.mid, ses: state.ses, at: serverTimestamp(), req },
      [`huntMine/${state.mid}/${day}/${n}/${i}`]: { item: reward.item, qty: reward.qty, at: serverTimestamp() },
    });
    return "mine";
  } catch {
    const v = (await get(ref(db, fp("campfires", String(day), "hunt", "found", String(i)))).catch(() => null))?.val?.();
    if (v && v.req === req) return "mine";
    return v ? "taken" : "fail";
  }
}
// 내 받을 줄 전체(날짜 제한 없음) → [{day, n, i, item, qty}]
export async function myHuntMine() {
  const all = (await get(ref(db, fp("huntMine", state.mid)))).val() || {};
  const out = [];
  for (const [day, ns] of Object.entries(all)) for (const [n, is] of Object.entries(ns || {})) for (const [i, r] of Object.entries(is || {}))
    if (r && typeof r.item === "string") out.push({ day: +day, n: +n, i: +i, item: r.item, qty: r.qty });
  return out;
}
export const dropHuntMine = (day, n, i) => remove(ref(db, fp("huntMine", state.mid, String(day), String(n), String(i)))).catch(() => {});

// ---- 생일 ----
let bDay = null, bUnsub = null;
// 오늘 카드 구독 → state.cardsToday = { 주인공mid: { 보낸mid: 카드 } }
export function watchCardsToday() {
  const d = kstDay(serverNow());
  if (d === bDay && bUnsub) return;
  if (bUnsub) bUnsub();
  bDay = d; state.cardsToday = {};
  bUnsub = onValue(ref(db, fp("bday", String(d))), s => {
    const v = s.val() || {}; state.cardsToday = Object.fromEntries(Object.entries(v).map(([m, x]) => [m, (x && x.cards) || {}])); emit("cards");
  }, () => {});
}
export const cardsDay = () => bDay;
export async function sendCard(day, toMid, emo, msg) {
  await set(ref(db, fp("bday", String(day), toMid, "cards", state.mid)), { emo, msg, at: serverTimestamp(), ses: state.ses });
}
// 나에게 온 카드 전체(지난 생일 포함) → [{day, from, card}]
export async function myCards() {
  const all = (await get(ref(db, fp("bday")))).val() || {};
  const out = [];
  for (const [day, people] of Object.entries(all)) for (const [from, c] of Object.entries((people && people[state.mid] && people[state.mid].cards) || {})) out.push({ day: +day, from, card: c });
  return out.sort((a, b) => b.day - a.day || a.from.localeCompare(b.from));
}
// 관리자: 생일 넣기/지우기("MM-DD" 또는 null)
// 규칙은 bdayOn/{mid}/{오늘 일 번호}로 '오늘이 생일인지' 확인하므로 생일과 발생일 목록(20년)을 한 번에 씀
export const setBday = (mid, v) => update(ref(db, fp()), { [`members/${mid}/bday`]: v || null, [`bdayOn/${mid}`]: v ? bdayOnDays(v, kstDate(serverNow()).y - 1) : null });
