import { mapTile, WALK_TILES } from './housing.js';

const key = (x, y) => `${x},${y}`;
const position = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const tilePosition = p => Number.isSafeInteger(p?.x) && Number.isSafeInteger(p?.y);
const validMap = map => Number.isSafeInteger(map?.w) && Number.isSafeInteger(map?.h) && map.w > 0 && map.h > 0 && Array.isArray(map.tiles) && map.tiles.length === map.w * map.h;
const waterCache = new WeakMap();   // 같은 지도·호수면 물 칸 계산을 다시 하지 않음(매 프레임 호출)
function lakeWater(map, lake) {
  const hit = waterCache.get(map); if (hit && hit.lake === lake) return hit.water;
  const water = lakeWaterNew(map, lake); waterCache.set(map, { lake, water }); return water;
}
function lakeWaterNew(map, lake) {
  if (!validMap(map) || !Number.isFinite(lake?.cx) || !Number.isFinite(lake?.cy)) throw new TypeError('잘못된 호수');
  const x = Math.floor(lake.cx), y = Math.floor(lake.cy);
  if (mapTile(map, x, y) !== 5) throw new TypeError('호수 중심이 물이 아니에요');
  const queue = [{ x, y }], seen = new Set([key(x, y)]);
  for (let i = 0; i < queue.length; i++) for (const [nx, ny] of [[queue[i].x - 1, queue[i].y], [queue[i].x + 1, queue[i].y], [queue[i].x, queue[i].y - 1], [queue[i].x, queue[i].y + 1]]) {
    if (mapTile(map, nx, ny) === 5 && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); queue.push({ x: nx, y: ny }); }
  }
  return seen;
}

// dt: 초, speed: 칸/초. 짧은 구간으로 나눠 좁은 땅을 뛰어넘지 않는다.
export function boatMove(map, lake, pos, dx, dy, dt, speed) {
  if (!position(pos) || ![dx, dy, dt, speed].every(Number.isFinite) || dt < 0 || speed < 0) throw new TypeError('잘못된 배 이동');
  const water = lakeWater(map, lake), allowed = (x, y) => water.has(key(Math.floor(x), Math.floor(y)));
  if (!allowed(pos.x, pos.y)) throw new TypeError('배가 호수 밖이에요');
  const length = Math.hypot(dx, dy), scale = length > 1 ? 1 / length : 1;
  const mx = dx * scale * speed * dt, my = dy * scale * speed * dt;
  if (!Number.isFinite(mx) || !Number.isFinite(my) || Math.hypot(mx, my) > 10000) throw new RangeError('배 이동 범위 초과');
  const steps = Math.max(1, Math.ceil(Math.hypot(mx, my) / 0.2));
  let { x, y } = pos;
  for (let i = 0; i < steps; i++) {
    const nx = x + mx / steps, ny = y + my / steps;
    if (allowed(nx, ny)) { x = nx; y = ny; }
    else { if (allowed(nx, y)) x = nx; if (allowed(x, ny)) y = ny; }
  }
  return { x, y };
}

export function canBoard(map, docks, pos) {
  if (!validMap(map) || !Array.isArray(docks) || !position(pos) || !docks.every(d => tilePosition(d) && tilePosition(d.boat))) throw new TypeError('잘못된 승선 요청');
  return [...docks].filter(d => WALK_TILES.includes(mapTile(map, d.x, d.y)) && mapTile(map, d.boat?.x, d.boat?.y) === 5 && Math.hypot(pos.x - d.x, pos.y - d.y) <= 1.5)
    .sort((a, b) => Math.hypot(pos.x - a.x, pos.y - a.y) - Math.hypot(pos.x - b.x, pos.y - b.y) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0))[0] ?? null;
}

export function disembarkSpot(map, dock, occupied = []) {
  if (!validMap(map) || !position(dock) || !Number.isSafeInteger(dock.x) || !Number.isSafeInteger(dock.y)
    || !(occupied instanceof Set || Array.isArray(occupied))) throw new TypeError('잘못된 하선 요청');
  const blocked = new Set(occupied instanceof Set ? occupied : occupied.map(p => { if (!position(p)) throw new TypeError('잘못된 점유 칸'); return key(Math.floor(p.x), Math.floor(p.y)); }));
  for (const o of map.objects ?? []) if (['tree', 'rock'].includes(o.k)) blocked.add(key(o.x, o.y));
  for (const h of map.houses ?? []) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) blocked.add(key(x, y));
  const cells = [];
  for (let y = dock.y - 2; y <= dock.y + 2; y++) for (let x = dock.x - 2; x <= dock.x + 2; x++) {
    if (Math.hypot(x - dock.x, y - dock.y) <= 2 && WALK_TILES.includes(mapTile(map, x, y)) && !blocked.has(key(x, y))) cells.push({ x, y });
  }
  return cells.sort((a, b) => Math.hypot(a.x - dock.x, a.y - dock.y) - Math.hypot(b.x - dock.x, b.y - dock.y) || a.y - b.y || a.x - b.x)[0] ?? null;
}
