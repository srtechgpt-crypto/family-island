// 버전 8 오늘의 부탁 게시판 — 순수 계산
// 들어주기·받기는 예약·환불 없이 "한 번의 묶음 쓰기"(update) 두 번. 규칙이 묶음을 깨면 통째로 거절한다.
// 계약: docs/데이터구조.md "버전 8"
import { removeItems, addItems } from './inventory.js';
import { record } from './playerOps.js';

export const REQ_ID = /^[a-z2-9]{10}$/;
export const DAY = /^[0-9]{8}$/;
const MIDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];

// 부탁할 수 있는 물건: board.kinds(재료·씨앗·물고기·요리)에 드는 아이템
export const askable = (items, board) => Object.keys(items).filter(k => board.kinds.includes(items[k].kind)).sort();

// 부탁 줄이 화면·처리에 쓸 만한 모양인지
export function validRequest(r, id) {
  return record(r) && r.id === id && REQ_ID.test(id) && MIDS.includes(r.by) && typeof r.item === 'string'
    && Number.isSafeInteger(r.qty) && r.qty >= 1 && r.qty <= 5 && [1, 2, 3].includes(r.slot) && Number.isFinite(r.at);
}

// 오늘 내 빈 자리(1~3) — 없으면 0
export function freeSlot(todayList, mid, perPerson = 3) {
  const used = new Set(Object.values(todayList || {}).filter(r => r && r.by === mid).map(r => r.slot));
  for (let s = 1; s <= perPerson; s++) if (!used.has(s)) return s;
  return 0;
}

// 부탁 만들기 본문(at·ses는 저장할 때 채움)
export function newRequest(id, mid, item, qty, slot, items, board) {
  if (!REQ_ID.test(id) || !MIDS.includes(mid)) return { ok: false, reason: '잘못된 요청' };
  if (!askable(items, board).includes(item)) return { ok: false, reason: '부탁할 수 없는 물건' };
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > board.maxQty) return { ok: false, reason: '개수는 1~5개' };
  if (![1, 2, 3].includes(slot)) return { ok: false, reason: '오늘 부탁은 3개까지예요' };
  return { ok: true, body: { id, by: mid, item, qty, slot } };
}

// 들어주기 묶음 쓰기: 내 가방 −qty, 도움 도장 +1, rev+1, done, 받을 줄. now = serverTimestamp 자리표시
export function helpPatch(player, mid, day, req, now) {
  if (!record(player) || !record(player.inv) || !Number.isSafeInteger(player.rev)) return { ok: false, reason: '잘못된 데이터' };
  if (!DAY.test(day) || !validRequest(req, req && req.id)) return { ok: false, reason: '없는 부탁' };
  if (req.done) return { ok: false, reason: '벌써 누가 들어줬어요' };
  if (req.by === mid) return { ok: false, reason: '내 부탁은 다른 가족이 들어줘요' };
  const removed = removeItems(player.inv, { [req.item]: req.qty });
  if (!removed.ok) return { ok: false, reason: '물건이 모자라요' };
  const left = removed.inv[req.item] ?? null;                           // 0이면 키를 지움(가방은 0을 두지 않음)
  const helped = (Number.isSafeInteger(player.helped) ? player.helped : 0) + 1;
  return { ok: true, patch: {
    [`players/${mid}/inv/${req.item}`]: left,
    [`players/${mid}/helped`]: helped,
    [`players/${mid}/rev`]: player.rev + 1,
    [`requests/${day}/${req.id}/done`]: { by: mid, at: now },
    [`reqMine/${req.by}/${req.id}`]: { day, item: req.item, qty: req.qty, at: now, from: mid },
  } };
}

// 받기 묶음 쓰기: 내 가방 +qty, applied q_id, rev+1, 받을 줄 삭제
export function receivePatch(player, mid, id, rec) {
  if (!record(player) || !record(player.inv) || !Number.isSafeInteger(player.rev) || !REQ_ID.test(id)) return { ok: false, reason: '잘못된 데이터' };
  if (!record(rec) || typeof rec.item !== 'string' || !Number.isSafeInteger(rec.qty) || rec.qty < 1) return { ok: false, reason: '잘못된 받을 물건' };
  if (record(player.applied) && player.applied['q_' + id] === true) return { ok: true, already: true, patch: { [`reqMine/${mid}/${id}`]: null } };
  const added = addItems(player.inv, { [rec.item]: rec.qty });
  if (!added.ok) return added;
  return { ok: true, patch: {
    [`players/${mid}/inv/${rec.item}`]: added.inv[rec.item],
    [`players/${mid}/applied/q_${id}`]: true,
    [`players/${mid}/rev`]: player.rev + 1,
    [`reqMine/${mid}/${id}`]: null,
  } };
}
