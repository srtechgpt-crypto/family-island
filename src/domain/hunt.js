// 버전 10 캠프 이벤트 '보물찾기' — 순수 계산
// 저장: campfires/{day}/hunt(지금 판 하나, 끝나면 n+1로 새 판) + huntMine/{mid}/{day}/{n}/{i}(받을 것). 계약: docs/데이터구조.md "버전 10"
import { validPlayer, keyId, fail, unchanged, finish, record } from './playerOps.js';
import { KST_OFFSET_MS } from './campfire.js';

export const HUNT = { count: 10, delayMs: 10000, durMs: 300000, minD: 6, maxD: 28, openR: 1.3, ruleR: 2.5, hintAfterMs: 60000 };
const DAY_MS = 86400000;
// 끝(시작 10초 + 5분 + 여유 10초)이 자정을 넘지 않게: KST 23:54:40부터는 새로 시작하지 않는다(규칙도 같은 값)
export const LAST_START_MS = DAY_MS - 320000;
export const canStartAt = now => Number.isSafeInteger(now) && (((now + KST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS < LAST_START_MS;

export const startAt = h => h.at + HUNT.delayMs;
export const endAt = h => h.at + HUNT.delayMs + HUNT.durMs;
// Firebase는 0~9 숫자 키를 배열로 돌려줄 수 있어(빈 칸은 null) 객체·배열 모두 받는다
const obj = v => v !== null && typeof v === 'object';
export const foundCount = h => Object.values((h && obj(h.found) && h.found) || {}).filter(Boolean).length;
// 'none'(없음) | 'count'(10초 세기) | 'run'(찾는 중) | 'done'(끝: 시간 지남 또는 10개 다 찾음)
export function huntPhase(h, now) {
  if (!validHunt(h)) return 'none';
  if (foundCount(h) >= HUNT.count || now >= endAt(h)) return 'done';
  return now < startAt(h) ? 'count' : 'run';
}
// 새 판을 시작해도 되는지(이전 판이 끝났거나 없음) — 횟수 제한 없음(대표님 2026-10-14)
export const canStartAfter = (h, now) => huntPhase(h, now) === 'none' || huntPhase(h, now) === 'done';

export function validHunt(h) {
  return record(h) && typeof h.id === 'string' && Number.isSafeInteger(h.n) && h.n >= 1 && Number.isSafeInteger(h.at)
    && /^m[0-5]$/.test(h.by) && obj(h.spots) && Array.from({ length: HUNT.count }, (_, i) => h.spots[i])
      .every(s => record(s) && Number.isInteger(s.x) && Number.isInteger(s.y));
}
export const spotList = h => Array.from({ length: HUNT.count }, (_, i) => h.spots[i]);
// 타일 (x,y)의 중심 = (x+0.5, y+0.5). presence·내 위치는 연속 타일 좌표
export const distToSpot = (s, px, py) => Math.hypot(px - (s.x + 0.5), py - (s.y + 0.5));

// 보물 자리 10곳: 캠프 둘레에서 걸어서 이어진 칸 중 중심 거리 6~28, 서로 간격 5(모자라면 4→3)
// walk(x,y) = 걸을 수 있는 칸인지(집·막힌 칸 포함), camp = {x,y} 캠프 불 칸, rand = 0~1 난수
export function pickSpots(walk, w, h, camp, rand, n = HUNT.count) {
  const cx = camp.x + 0.5, cy = camp.y + 0.5, seen = new Uint8Array(w * h), q = [];
  for (let y = camp.y - 2; y <= camp.y + 2; y++) for (let x = camp.x - 2; x <= camp.x + 2; x++)
    if (x >= 0 && y >= 0 && x < w && y < h && walk(x, y) && !seen[y * w + x]) { seen[y * w + x] = 1; q.push([x, y]); }
  const cand = [];
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k], d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= HUNT.minD && d <= HUNT.maxD) cand.push({ x, y });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !walk(nx, ny)) continue;
      if (Math.hypot(nx + 0.5 - cx, ny + 0.5 - cy) > HUNT.maxD + 2) continue;
      seen[ny * w + nx] = 1; q.push([nx, ny]);
    }
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  for (const gap of [5, 4, 3]) {
    const out = [];
    for (const c of cand) { if (out.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= gap)) out.push(c); if (out.length === n) return out; }
  }
  return null;   // 자리가 모자람 → 시작하지 않음
}

// 덤 물건: 판 id + 보물 번호로 고정(모든 폰·다시 계산해도 같음). 받을 것은 huntMine 줄에 적어 두므로 표가 바뀌어도 지급은 그대로
function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
export function huntBonus(huntId, i, table) {
  const r = table[hash(huntId + '#' + i) % table.length];
  return { item: r.item, qty: r.qty };
}
export const payKey = (day, n, i) => `t_${day}_${n}_${i}`;
// 보물 하나 지급: 보석 1 + 덤. 같은 키는 한 번만(done)
export function payHunt(player, key, reward, items) {
  if (!validPlayer(player) || !keyId(key) || !/^t_[0-9]+_[0-9]+_[0-9]$/.test(key)) return fail('잘못된 요청');
  if (Object.hasOwn(player.done ?? {}, key) && player.done[key] === true) return unchanged(player);
  if (!record(reward) || !items?.[reward.item] || !Number.isSafeInteger(reward.qty) || reward.qty < 1 || reward.qty > 5) return fail('잘못된 보물');
  const add = reward.item === 'gem' ? { gem: 1 + reward.qty } : { gem: 1, [reward.item]: reward.qty };
  return finish(player, key, {}, add);
}
// 결과: 사람별 개수, 1등(공동 포함, 0개면 없음)
export function huntResult(h) {
  const count = {};
  for (const f of Object.values((h && obj(h.found) && h.found) || {})) if (f && /^m[0-5]$/.test(f.by)) count[f.by] = (count[f.by] || 0) + 1;
  const best = Math.max(0, ...Object.values(count));
  return { count, total: foundCount(h), winners: best > 0 ? Object.keys(count).filter(m => count[m] === best).sort() : [], best };
}
