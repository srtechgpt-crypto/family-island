// 버전 10 생일 잔치 — 순수 계산
// 생일: members/{mid}/bday "MM-DD"(관리자). 카드: bday/{KST 일 번호}/{주인공}/cards/{보낸 사람}. 계약: docs/데이터구조.md "버전 10"
import { validPlayer, keyId, fail, unchanged, finish, record } from './playerOps.js';
import { KST_OFFSET_MS, kstDay } from './campfire.js';

// 월별 최대 일수(2월은 29일까지 — 평년엔 2월 28일에 잔치)
export const BDAY_RE = /^((0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9])|(0[13-9]|1[0-2])-30|(0[13578]|1[02])-31)$/;
export const CARD_EMO = ['🎂', '🎁', '🎈', '💖', '🌟', '🎉'];
export const CARD_MSG = ['생일 축하해요!', '사랑해요 💕', '맛있는 거 많이 먹어요', '행복한 하루 보내요', '언제나 고마워요', '건강하게 자라요'];
export const MSG_MAX = 30;
export const GIFT_DAYS = 7;   // 주인공 몫 선물(케이크 장식·풍선)은 생일~7일 뒤 들어올 때까지 자동으로

const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function kstDate(ms) { const d = new Date(ms + KST_OFFSET_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
// 그해 생일의 KST 일 번호(2/29는 평년엔 2/28)
export function bdayDayIn(bday, year) {
  if (!BDAY_RE.test(bday || '')) return null;
  let [m, d] = bday.split('-').map(Number);
  if (m === 2 && d === 29 && !leap(year)) d = 28;
  return Date.UTC(year, m - 1, d) / 86400000;
}
// 규칙이 확인할 생일 발생일 목록(KST 일 번호 → true): 올해부터 years년 — 관리자가 생일을 넣을 때 함께 저장
export function bdayOnDays(bday, fromYear, years = 20) {
  const out = {}; for (let y = fromYear; y < fromYear + years; y++) { const d = bdayDayIn(bday, y); if (d !== null) out[d] = true; }
  return out;
}
export const isBirthday = (bday, now) => bdayDayIn(bday, kstDate(now).y) === kstDay(now);
// 오늘 생일인 사람들(mid 정렬)
export const birthdaysToday = (members, now) => Object.keys(members || {}).filter(m => /^m[0-5]$/.test(m) && isBirthday(members[m] && members[m].bday, now)).sort();
// 가장 최근 생일(오늘 포함)이 within일 안이면 그 일 번호, 아니면 null — 연말 생일을 새해에 받아도 같은 날로
export function recentBday(bday, now, within = GIFT_DAYS) {
  const today = kstDay(now), y = kstDate(now).y;
  for (const yy of [y, y - 1]) { const d = bdayDayIn(bday, yy); if (d !== null && d <= today && today - d <= within) return d; }
  return null;
}
export function validCard(c) {
  return record(c) && CARD_EMO.includes(c.emo) && typeof c.msg === 'string' && c.msg.trim().length >= 1 && c.msg.length <= MSG_MAX && Number.isFinite(c.at);
}
function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
export const giftFor = (day, from, table) => { const r = table[hash(day + '#' + from) % table.length]; return { item: r.item, qty: r.qty }; };
export const cardKey = (day, from) => `b_${day}_${from}`;
export const selfKey = day => `b_${day}_self`;
// 카드 상자 열기: 케이크 조각 1 + 선물. 같은 카드는 한 번만
export function openCard(player, day, from, gift, items) {
  const key = cardKey(day, from);
  if (!validPlayer(player) || !keyId(key) || !Number.isSafeInteger(day) || !/^m[0-5]$/.test(from)) return fail('잘못된 요청');
  if (Object.hasOwn(player.done ?? {}, key) && player.done[key] === true) return unchanged(player);
  if (!record(gift) || !items?.[gift.item] || !Number.isSafeInteger(gift.qty) || gift.qty < 1 || gift.qty > 5) return fail('잘못된 선물');
  const add = gift.item === 'food_cake_slice' ? { food_cake_slice: 1 + gift.qty } : { food_cake_slice: 1, [gift.item]: gift.qty };
  return finish(player, key, {}, add);
}
// 주인공 몫: 생일 케이크 장식 + 풍선 다발(가구, 보관함으로)
export function selfGift(player, day) {
  const key = selfKey(day);
  if (!validPlayer(player) || !record(player.furn) || !Number.isSafeInteger(day)) return fail('잘못된 요청');
  if (Object.hasOwn(player.done ?? {}, key) && player.done[key] === true) return unchanged(player);
  const cake = `f_b${day}_cake`, bal = `f_b${day}_balloon`;
  if (Object.hasOwn(player.furn, cake) || Object.hasOwn(player.furn, bal)) return fail('가구 ID 중복');
  return finish(player, key, { furn: { ...player.furn, [cake]: { type: 'bday_cake', state: 'stored' }, [bal]: { type: 'balloon_bunch', state: 'stored' } } });
}
