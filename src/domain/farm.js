// 버전 7 목장: 텃밭 자람·수확량, 심기 예약(farmPend), 씨앗 상자 종류, 달걀 공급 — 순수 계산
import { removeItems, addItems } from './inventory.js';
import { validPlayer, fail, unchanged, record } from './playerOps.js';
import { zoneOf } from './rounds.js';

export const PLANT_ID = /^[a-z2-9]{10}$/;
export const PLOT_ID = /^p[0-9]{2}$/;
const MIDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];

const cropOf = (farm, crop) => Object.hasOwn(farm?.crops ?? {}, crop) ? farm.crops[crop] : null;

// 물 기록 {by, at}: w2는 w1과 다른 사람일 때만 유효(규칙과 같은 기준)
export function waterCount(plot) {
  const ok = w => record(w) && typeof w.by === 'string' && Number.isFinite(w.at);
  if (!ok(plot?.w1)) return 0;
  return ok(plot.w2) && plot.w2.by !== plot.w1.by ? 2 : 1;
}
export const harvestQty = plot => 1 + waterCount(plot);

// 화면용 자람 상태: stage 0 씨앗 / 1 싹(25%) / 2 자람(60%) / 3 다 자람, left = 남은 ms
export function growth(plot, farm, nowMs) {
  const c = cropOf(farm, plot?.crop);
  if (!c || !Number.isFinite(plot.at) || !Number.isFinite(nowMs)) return null;
  const readyAt = plot.at + c.ms, p = Math.max(0, Math.min(1, (nowMs - plot.at) / c.ms));
  return { stage: p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.25 ? 1 : 0, p, readyAt, left: Math.max(0, readyAt - nowMs), waters: waterCount(plot), qty: harvestQty(plot), item: c.item };
}

// 물 줄 수 있나: 다 자라기 전, w1 없으면 누구나 / w1 있으면 다른 가족만 w2
export function waterSlot(plot, farm, mid, nowMs) {
  const g = growth(plot, farm, nowMs);
  if (!g) return { ok: false, reason: '없는 작물' };
  if (g.stage === 3) return { ok: false, reason: '다 자랐어요' };
  if (!plot.w1) return { ok: true, slot: 'w1' };
  if (plot.w2) return { ok: false, reason: '물을 충분히 먹었어요' };
  if (plot.w1.by === mid) return { ok: false, reason: '다른 가족이 한 번 더 줄 수 있어요' };
  return { ok: true, slot: 'w2' };
}

// 수확 기록(심은 사람 farmMine에 들어갈 것)
export function harvestRecord(plot, farm, plotId) {
  const c = cropOf(farm, plot?.crop);
  if (!c || !PLOT_ID.test(plotId) || !PLANT_ID.test(plot.id ?? '') || !MIDS.includes(plot.by)) return null;
  return { owner: plot.by, id: plot.id, item: c.item, qty: harvestQty(plot), plot: plotId };
}

// 심기 1단계(개인 트랜잭션): 씨앗 1개 빼고 예약을 남긴다. 같은 plantId 재시도는 그대로.
export function reservePlant(player, plantId, plotId, crop, farm) {
  if (!validPlayer(player) || !PLANT_ID.test(plantId) || !PLOT_ID.test(plotId)) return fail('잘못된 요청');
  const c = cropOf(farm, crop); if (!c) return fail('없는 작물');
  const pend = record(player.farmPend) ? player.farmPend : {};
  if (Object.hasOwn(pend, plantId)) return unchanged(player);
  const removed = removeItems(player.inv, { [c.seed]: 1 });
  if (!removed.ok) return fail('씨앗이 없어요');
  return { ok: true, changed: true, player: { ...player, inv: removed.inv, farmPend: { ...pend, [plantId]: { plot: plotId, crop } }, rev: player.rev + 1 } };
}

// 심기 2단계: 칸에 내 작물이 있으면 예약만 지우고, 없으면 씨앗을 돌려준다. 예약이 없으면 그대로(두 번 처리 방지).
export function settlePlant(player, plantId, planted, farm) {
  if (!validPlayer(player) || !PLANT_ID.test(plantId)) return fail('잘못된 요청');
  const pend = record(player.farmPend) ? player.farmPend : {};
  if (!Object.hasOwn(pend, plantId)) return unchanged(player);
  const { [plantId]: p, ...rest } = pend;
  if (!planted && record(player.applied) && player.applied['f_' + plantId] === true) planted = true;   // 이미 거둬 받은 작물은 환불 없음
  let inv = player.inv;
  if (!planted) {
    const c = cropOf(farm, p?.crop);
    if (c) { const a = addItems(inv, { [c.seed]: 1 }); if (!a.ok) return a; inv = a.inv; }
  }
  return { ok: true, changed: true, refunded: !planted, player: { ...player, inv, farmPend: rest, rev: player.rev + 1 } };
}

// farmMine 한 줄 → applyClaim이 받는 모양
export function farmClaim(plantId, mid, rec) {
  if (!PLANT_ID.test(plantId) || !record(rec) || typeof rec.item !== 'string' || !Number.isSafeInteger(rec.qty) || !Number.isSafeInteger(rec.at)) return null;
  return { id: 'f_' + plantId, by: mid, item: rec.item, qty: rec.qty, at: rec.at };
}

// 씨앗 상자: 회차(YYYYMMDD, 오전 5시 기준 하루) + 가족 순번으로 종류가 날마다 바뀜
export function seedOfDay(round, mid, farm) {
  if (typeof round !== 'string' || !/^\d{8}$/.test(round) || !MIDS.includes(mid)) throw new TypeError('잘못된 씨앗 상자 요청');
  const days = Math.floor(Date.UTC(+round.slice(0, 4), +round.slice(4, 6) - 1, +round.slice(6, 8)) / 86400000);
  const order = farm.order, crop = order[(days + MIDS.indexOf(mid)) % order.length];
  return farm.crops[crop].seed;
}

// 달걀: 오늘 누군가 모이를 줬으면 이번 회차 둥지마다 1개(30분 채집과 같은 기록 구조)
export function eggSupply(farm, fed) {
  if (!fed) return [];
  return farm.nests.map(n => ({ id: n.id, kind: 'egg', x: n.x, y: n.y, item: 'egg', zone: zoneOf(n.x, n.y) }));
}
export const feedZone = farm => zoneOf(farm.trough.x, farm.trough.y);
export const seedboxZone = farm => zoneOf(farm.seedbox.x, farm.seedbox.y);
export const fedToday = (isTaken, farm) => MIDS.some(m => isTaken(feedZone(farm), 'feed_' + m));
