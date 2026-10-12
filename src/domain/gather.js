// data/gathering.json과 같은 기본 수량표(브라우저에서 JSON import를 쓰지 않으려고 코드에 둠 — 시험이 두 값이 같은지 확인)
export const DEFAULT_GATHERING = Object.freeze({ ver: 4, generalForage: 6, weeds: 10, fruitTrees: 150, fruitPerTree: 2, daily: Object.freeze(['shell', 'stone', 'branch', 'honeycomb']) });
const gathering = DEFAULT_GATHERING;
import { pickForage } from './forage.js';
import { zoneOf } from './rounds.js';
import { mapTile } from './housing.js';

export const GATHER_MS = 1800000;
export const RECOVER_MS = 336 * 3600000;
const validKey = key => typeof key === 'string' && /^h[1-9][0-9]{7}$/.test(key);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
const cellKey = p => `${p.x},${p.y}`;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function gatherNo(serverMs) {
  if (!Number.isSafeInteger(serverMs) || serverMs < 0) throw new TypeError('잘못된 서버 시간');
  const n = Math.floor(serverMs / GATHER_MS);
  if (n + 10000000 > 99999999) throw new RangeError('회차 범위 초과');
  return n;
}
export const gatherKey = serverMs => `h${gatherNo(serverMs) + 10000000}`;
export const nextGatherAt = serverMs => (gatherNo(serverMs) + 1) * GATHER_MS;

export function gatherClaimId(key, zone, id) {
  if (!validKey(key) || typeof zone !== 'string' || !/^z[0-9]+_[0-9]+$/.test(zone) || !validId(id)) throw new TypeError('잘못된 채집 ID');
  return `g_${key}_${zone}_${id}`;
}

export function fruitTreesFor(map, round, config = gathering) {
  if (!validKey(round) || !Array.isArray(map?.objects) || !Number.isSafeInteger(config?.fruitTrees)
    || config.fruitTrees < 0 || !Number.isSafeInteger(config.fruitPerTree) || config.fruitPerTree < 1) throw new TypeError('잘못된 열매 요청');
  const trees = map.objects.filter(o => o.k === 'tree');
  if (!trees.every(t => validId(t.id)) || new Set(trees.map(t => t.id)).size !== trees.length || trees.length < config.fruitTrees) throw new TypeError('잘못된 열매 나무');
  return pickForage(trees, round + '|fruit', config.fruitTrees).map(t => t.id);
}

// v3 World.weedsFor의 31 해시와 LCG를 그대로 사용하되 고정 배포 데이터만 참조한다.
export function weedsFor(map, fields, forage, round, count = gathering.weeds) {
  const fieldList = Array.isArray(fields) ? fields : fields?.fields;
  if (!validKey(round) || !Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(map?.w) || !Number.isSafeInteger(map?.h)
    || map.w <= 0 || map.h <= 0 || !Array.isArray(map.tiles) || map.tiles.length !== map.w * map.h || !Array.isArray(map.objects)
    || !Array.isArray(fieldList) || !fieldList.every(f => Array.isArray(f?.cells)) || !Array.isArray(forage?.candidates)) throw new TypeError('잘못된 잡초 요청');
  const cells = fieldList.flatMap(f => f.cells);
  const occupied = new Set([...map.objects, ...(forage?.candidates ?? []), ...cells, ...(map.docks ?? [])].map(cellKey));
  const nearHouse = (x, y) => (map.houses ?? []).some(h => x >= h.x - 1 && x <= h.x + h.w && y >= h.y - 1 && y <= h.y + h.h + 2);
  let s = 0; for (const c of round) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let tries = 0; out.length < count && tries < 5000; tries++) {
    const x = Math.floor(rnd() * map.w), y = Math.floor(rnd() * map.h), k = `${x},${y}`;
    if (mapTile(map, x, y) !== 2 || occupied.has(k) || nearHouse(x, y)) continue;
    occupied.add(k);
    out.push({ id: `w${x}_${y}`, kind: 'weed', x, y, item: 'weed', zone: zoneOf(x, y) });
  }
  if (out.length !== count) throw new RangeError('잡초 자리 부족');
  return out;
}

export function gatherSupply(map, fields, forage, round) {
  if (!validKey(round) || !Number.isSafeInteger(map?.w) || !Number.isSafeInteger(map?.h)
    || map.w <= 0 || map.h <= 0 || !Array.isArray(map.tiles) || map.tiles.length !== map.w * map.h
    || !Array.isArray(map.objects) || !Array.isArray(forage?.candidates)) throw new TypeError('잘못된 채집 데이터');
  const fieldList = Array.isArray(fields) ? fields : fields?.fields;
  if (!Array.isArray(fieldList) || !fieldList.every(f => Array.isArray(f?.cells))) throw new TypeError('잘못된 밭');
  const config = forage.gathering ?? gathering;
  for (const k of ['generalForage', 'weeds']) if (!Number.isSafeInteger(config[k]) || config[k] < 0) throw new TypeError('잘못된 채집 수량');
  const add = (p, kind, item = p.item) => {
    if (!validId(p.id) || !Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y) || mapTile(map, p.x, p.y) < 0 || !validId(item)) throw new TypeError('잘못된 채집 칸');
    return { id: p.id, kind, x: p.x, y: p.y, item, zone: zoneOf(p.x, p.y) };
  };
  if (forage.candidates.length < config.generalForage) throw new RangeError('일반 채집 후보 부족');
  const out = [
    ...fieldList.flatMap(f => f.cells.map(p => add(p, 'field'))),
    ...pickForage(forage.candidates, round, config.generalForage).map(p => add(p, 'forage')),
    ...weedsFor(map, fieldList, forage, round, config.weeds),
    ...map.objects.filter(o => o.k === 'flower').map(p => add(p, 'flower', `flower_${p.c}`)),
  ];
  if (new Set(out.map(p => p.id)).size !== out.length || new Set(out.map(cellKey)).size !== out.length) throw new TypeError('채집 칸 중복');
  return out;
}

export function recoverPlan(mineEntries, applied, nowMs) {
  gatherNo(nowMs);
  if ((mineEntries != null && !record(mineEntries)) || (applied != null && !record(applied))) throw new TypeError('잘못된 복구 목록');
  const grant = [], drop = [];
  for (const [id, at] of Object.entries(mineEntries ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!/^g_h[1-9][0-9]{7}_z[0-9]+_[0-9]+_[A-Za-z0-9_-]+$/.test(id) || !Number.isSafeInteger(at) || at < 0 || at > nowMs) throw new TypeError('잘못된 복구 기록');
    (Object.hasOwn(applied ?? {}, id) || nowMs - at > RECOVER_MS ? drop : grant).push(id);
  }
  return { grant, drop };
}

// gather 지급 시각은 숫자로 저장한다. 옛 boolean gather 표식은 회차 끝까지 보수적으로 보존한다.
export function pruneGatherApplied(applied, nowMs) {
  gatherNo(nowMs);
  if (!record(applied)) throw new TypeError('잘못된 지급 목록');
  return Object.fromEntries(Object.entries(applied).filter(([id, at]) => {
    const match = /^g_h([1-9][0-9]{7})_z[0-9]+_[0-9]+_[A-Za-z0-9_-]+$/.exec(id);
    if (!match) return true;
    const timestamp = at === true ? (Number(match[1]) - 10000000 + 1) * GATHER_MS : at;
    if (!Number.isSafeInteger(timestamp) || timestamp < 0 || (at !== true && timestamp > nowMs)) throw new TypeError('잘못된 지급 시각');
    return nowMs - timestamp <= RECOVER_MS;
  }));
}
