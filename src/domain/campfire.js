import { validPlayer, keyId, fail, done, unchanged, finish, record } from './playerOps.js';

export const KST_OFFSET_MS = 32400000;
const DAY_MS = 86400000;
export const kstDay = ms => Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
export const campHour = ms => ((ms + KST_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS / 3600000;
export const isCampOpen = ms => Number.isFinite(ms) && campHour(ms) >= 19 && campHour(ms) < 22;
export const campEndsAt = day => day * DAY_MS - KST_OFFSET_MS + 22 * 3600000;
export const fireScale = n => 0.65 + (Math.max(1, Math.min(6, n)) - 1) * 0.14;
export const ROAST_MS = 6000;
export const roastResult = elapsedMs => elapsedMs < 3300 ? 'raw' : elapsedMs < 4800 ? 'golden' : 'burnt';

export function familyAtFire(presenceIsland, members, center, radius, nowMs) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(center?.x) || !Number.isFinite(center?.y)
    || !Number.isFinite(radius) || radius < 0) return [];
  const mids = new Set();
  for (const [ses, p] of Object.entries(presenceIsland ?? {})) {
    if (!p || !/^m[0-5]$/.test(p.m) || members?.[p.m]?.ses !== ses) continue;
    if (!Number.isFinite(p.t) || nowMs - p.t < 0 || nowMs - p.t > 30000) continue;
    if (Number.isFinite(p.x) && Number.isFinite(p.y) && Math.hypot(p.x - center.x, p.y - center.y) <= radius) mids.add(p.m);
  }
  return [...mids].sort();
}

export function applyRoast(player, day, result, reqId) {
  if (!validPlayer(player) || !keyId(reqId)) return fail('잘못된 요청');
  if (done(player, reqId)) return unchanged(player);
  if (!Number.isSafeInteger(day) || day < 0 || !['raw', 'golden', 'burnt'].includes(result)) return fail('잘못된 요청');
  if ((player.camp !== undefined && !record(player.camp)) || (player.roast !== undefined && !record(player.roast))) return fail('잘못된 기록');
  const n = player.camp?.[day]?.n ?? 0;
  if (!Number.isInteger(n) || n < 0 || n >= 3) return fail('오늘은 세 번 다 구웠어요');
  return finish(player, reqId, {
    camp: { ...player.camp, [day]: { n: n + 1 } },
    roast: { ...player.roast, [day]: { ...player.roast?.[day], [n]: result } },
  }, { [`food_marsh_${result}`]: 1 });
}
