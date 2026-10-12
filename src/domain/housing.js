export const HOUSE_W = 6, HOUSE_H = 5;
export const doorOf = ({ x, y }) => ({ x: x + 2, y: y + 4 });
export const WALK_TILES = [1, 2, 4, 6];
const key = (x, y) => `${x},${y}`;
const rectHas = (r, x, y, margin = 0) => x >= r.x - margin && x < r.x + r.w + margin && y >= r.y - margin && y < r.y + r.h + margin;
const eachCell = (r, fn, margin = 0) => {
  for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) fn(x, y);
};
export const mapTile = (map, x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h ? map.tiles[y * map.w + x] : -1;

export function housesFrom(mapHouses, housingVal) {
  return mapHouses.map(h => {
    const saved = housingVal?.houses?.[h.mid]?.pos;
    const pos = Number.isSafeInteger(saved?.x) && Number.isSafeInteger(saved?.y) ? saved : h;
    return { mid: h.mid, x: pos.x, y: pos.y, w: HOUSE_W, h: HOUSE_H, door: doorOf(pos) };
  });
}

export function treeDropSpots(map, tree, n = 3, { forage, insects, fields, docks = map.docks } = {}) {
  if (!Array.isArray(map?.objects) || !Number.isSafeInteger(tree?.x) || !Number.isSafeInteger(tree?.y) || !Number.isSafeInteger(n) || n < 0) throw new TypeError('잘못된 낙하 칸 요청');
  const cand = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, 2], [-1, -1], [1, -1], [0, -1]];
  // v4의 밀집 숲에서도 네 번째 벌집 칸을 찾는다. 기존 우선순위는 보존한다.
  if (map.ver === 4) for (let radius = 2; radius <= 4; radius++) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === radius && !cand.some(([a, b]) => a === dx && b === dy)) cand.push([dx, dy]);
    }
  }
  const occupied = new Set(map.objects.map(o => key(o.x, o.y))), out = [];
  for (const def of [forage, insects]) for (const p of def?.candidates ?? []) occupied.add(key(p.x, p.y));
  for (const f of (Array.isArray(fields) ? fields : fields?.fields) ?? []) for (const p of f.cells) occupied.add(key(p.x, p.y));
  for (const p of docks ?? []) occupied.add(key(p.x, p.y));
  for (const [dx, dy] of cand) {
    if (out.length >= n) break;
    const x = tree.x + dx, y = tree.y + dy;
    if (WALK_TILES.includes(mapTile(map, x, y)) && !occupied.has(key(x, y))) out.push({ x, y });
  }
  return out;
}

export function reachedFrom(map, houses = []) {
  const solid = new Set(map.objects.filter(o => ['tree', 'rock'].includes(o.k)).map(o => key(o.x, o.y)));
  for (const h of houses) eachCell(h, (x, y) => solid.add(key(x, y)));
  const walk = (x, y) => WALK_TILES.includes(mapTile(map, x, y)) && !solid.has(key(x, y));
  const queue = walk(map.spawn.x, map.spawn.y) ? [map.spawn] : [];
  const seen = new Set(queue.map(p => key(p.x, p.y)));
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (walk(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); queue.push({ x: nx, y: ny }); }
    }
  }
  return seen;
}

export function buildPlacementStatic(map, { forage, insects, campfire, fields, lake, docks = map.docks ?? lake?.docks, ranch = map.ranch } = {}) {
  const objects = new Set(map.objects.map(o => key(o.x, o.y)));
  const solidObjects = new Set(map.objects.filter(o => ['tree', 'rock'].includes(o.k)).map(o => key(o.x, o.y)));
  const blocked = new Set(), protectedCells = new Set();
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (!WALK_TILES.includes(mapTile(map, x, y)) || solidObjects.has(key(x, y))) blocked.add(key(x, y));
    if (mapTile(map, x, y) === 6) {
      protectedCells.add(key(x, y));
      // Every walkable bank neighbor of the bridge is an end cell, also protected.
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (WALK_TILES.includes(mapTile(map, nx, ny))) protectedCells.add(key(nx, ny));
      }
    }
  }
  eachCell({ x: map.spawn.x - 2, y: map.spawn.y - 2, w: 5, h: 5 }, (x, y) => protectedCells.add(key(x, y)));
  if (campfire?.plaza) eachCell(campfire.plaza, (x, y) => protectedCells.add(key(x, y)), 1);
  for (const tree of map.objects.filter(o => o.k === 'tree')) {
    // Also protect the fourth (honey) drop. First three remain fruit positions.
    for (const p of treeDropSpots(map, tree, 4, { forage, insects, fields, docks })) protectedCells.add(key(p.x, p.y));
  }
  for (const def of [forage, insects]) for (const p of def?.candidates ?? []) protectedCells.add(key(p.x, p.y));
  const reserve = p => { protectedCells.add(key(p.x, p.y)); blocked.add(key(p.x, p.y)); };
  if (ranch) eachCell(ranch, (x, y) => reserve({ x, y }));
  for (const d of docks ?? []) { reserve(d); if (d.boat) reserve(d.boat); }
  for (const f of (Array.isArray(fields) ? fields : fields?.fields) ?? []) for (const p of f.cells) reserve(p);
  // 타일 5는 기본 blocked이며 호수 보호도 포함한다. 다른 연못도 집 배치 금지.
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (mapTile(map, x, y) === 5) protectedCells.add(key(x, y));
  return { map, objects, blocked, protectedCells, campfire, fields, lake, docks, ranch };
}

export const PLACE_REASON_TEXT = {
  integer: '칸 단위로 자리를 골라 주세요', bounds: '집과 둘레가 지도 밖이에요',
  terrain: '풀이나 모래 위에 놓아 주세요', object: '물건이 있는 자리예요', protected: '함께 쓰는 자리예요',
  perimeter: '집 둘레에 물건이나 물, 길이 있어요', spacing: '다른 집과 가까워요',
  door: '문 앞 두 칸을 비워 주세요', route: '가족이 걸어서 갈 수 없어요',
};

export function validateHousePlacement(stat, houses, movingMid, pos) {
  const reasons = new Set(), add = reason => reasons.add(reason);
  if (!Number.isSafeInteger(pos?.x) || !Number.isSafeInteger(pos?.y)) return { ok: false, reasons: ['integer'] };
  const { map, objects, protectedCells } = stat;
  const r = { mid: movingMid, x: pos.x, y: pos.y, w: HOUSE_W, h: HOUSE_H, door: doorOf(pos) };
  if (r.x < 1 || r.y < 1 || r.x + r.w >= map.w || r.y + r.h >= map.h) add('bounds');
  const original = map.houses?.find(h => h.mid === movingMid);
  const atOriginal = original?.x === r.x && original?.y === r.y;
  const legacyPath = (x, y) => atOriginal && x === r.x + 2 && (y === r.y + 4 || y === r.y + 5) && mapTile(map, x, y) === 4;
  eachCell(r, (x, y) => {
    if (![1, 2].includes(mapTile(map, x, y)) && !legacyPath(x, y)) add('terrain');
    if (objects.has(key(x, y))) add('object');
    if (protectedCells.has(key(x, y))) add('protected');
  });
  eachCell(r, (x, y) => {
    if (rectHas(r, x, y)) return;
    if (protectedCells.has(key(x, y)) && !atOriginal) add('protected');
    // Existing map decoration (three flowers and t188) is grandfathered only
    // at the owner's exact default position. Door clearance is never exempt.
    if ((!atOriginal && objects.has(key(x, y))) || (![1, 2].includes(mapTile(map, x, y)) && !legacyPath(x, y))) add('perimeter');
  }, 1);
  const others = houses.filter(h => h.mid !== movingMid);
  for (const h of others) if (!(r.x + r.w + 2 <= h.x || h.x + h.w + 2 <= r.x || r.y + r.h + 2 <= h.y || h.y + h.h + 2 <= r.y)) add('spacing');
  for (const dy of [5, 6]) {
    const x = r.x + 2, y = r.y + dy;
    if (!WALK_TILES.includes(mapTile(map, x, y)) || objects.has(key(x, y)) || others.some(h => rectHas(h, x, y))) add('door');
  }
  if (!reasons.has('bounds')) {
    const next = [...others, r], seen = reachedFrom(map, next);
    if (next.some(h => !seen.has(key(h.x + 2, h.y + 5))) || (stat.campfire && !seen.has(key(stat.campfire.x, stat.campfire.y)))) add('route');
  }
  return { ok: reasons.size === 0, reasons: [...reasons] };
}

export function resolveHouses(stat, mapHouses, housingVal) {
  if (!stat?.map || !Array.isArray(mapHouses) || mapHouses.length !== 6
    || new Set(mapHouses.map(h => h.mid)).size !== 6
    || !mapHouses.every(h => /^m[0-5]$/.test(h.mid) && Number.isSafeInteger(h.x) && Number.isSafeInteger(h.y))
    || (housingVal != null && (typeof housingVal !== 'object' || Array.isArray(housingVal)))) throw new TypeError('잘못된 집 목록');
  const defaults = [...mapHouses].sort((a, b) => a.mid < b.mid ? -1 : 1).map(h => ({ mid: h.mid, x: h.x, y: h.y, w: HOUSE_W, h: HOUSE_H, door: doorOf(h) }));
  const resolved = [];
  for (let i = 0; i < defaults.length; i++) {
    const base = defaults[i], saved = housingVal?.houses?.[base.mid]?.pos;
    // 앞 mid가 먼저 확정된다. 뒤 집의 미사용 기본 자리가 유효한 이동을 막지 않는다.
    const others = resolved.filter(h => h.source !== null);
    const reasons = saved == null ? [] : validateHousePlacement(stat, others, base.mid, saved).reasons;
    if (saved != null && reasons.length === 0) {
      resolved.push({ ...base, x: saved.x, y: saved.y, door: doorOf(saved), source: 'saved', reasons: [] });
      continue;
    }
    const fallback = validateHousePlacement(stat, others, base.mid, base);
    resolved.push(fallback.ok ? { ...base, source: 'default', reasons }
      : { mid: base.mid, x: null, y: null, w: HOUSE_W, h: HOUSE_H, door: null, source: null, reasons: [...new Set([...reasons, ...fallback.reasons])] });
  }
  return resolved;
}

export function planHouseMove(housingVal, mid, pos, reqId) {
  return { [`houses/${mid}/pos`]: { x: pos.x, y: pos.y, req: reqId }, rev: (housingVal?.rev || 0) + 1 };
}
