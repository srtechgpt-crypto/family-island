// 버전 12 마당: 내 집 둘레 2칸 띠에 마당 물건(yard)·길(path) 놓기(순수 함수)
// 저장: players/{mid}/furn/{id} = { type, state:"placed", room:"yard", x, y, rot, pr? } — x,y = 집 왼쪽 위 기준 상대 칸 + 3
// ctx = { houses:[{mid,x,y,w,h,door}], walkTile(x,y)→bool(모래·풀·길·다리), staticBlocked(x,y)→bool(나무·바위·시설), reserved:Set("x,y") }
import { layerOf } from "./placement.js";

const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = Number.isSafeInteger;
const fail = reason => ({ ok: false, reason });
const key = (x, y) => `${x},${y}`;
export const BAND = 2, OFF = 3;
export const YARD_LAYERS = new Set(["yard", "path"]);
const inRect = (h, x, y, m = 0) => x >= h.x - m && x < h.x + h.w + m && y >= h.y - m && y < h.y + h.h + m;

const sizeOf = (defs, f, rot) => { const d = defs[f.type]; if (!record(d)) return null; return rot % 2 ? [d.h, d.w] : [d.w, d.h]; };
export const isYardType = (defs, type) => YARD_LAYERS.has(layerOf(defs, type));
export const solidType = (defs, type) => record(defs[type]) && defs[type].solid === true;

// 이 칸이 이 집(mid)의 마당으로 쓸 수 있는 칸인가 — 집 위치·지도만으로 정해져 모든 폰이 같다
export function yardCellOk(ctx, mid, x, y) {
  const me = ctx.houses.find(h => h.mid === mid); if (!me) return false;
  if (!inRect(me, x, y, BAND)) return false;
  for (const h of ctx.houses) {
    if (inRect(h, x, y)) return false;                                    // 집 몸체
    if (x === h.door.x && (y === h.door.y + 1 || y === h.door.y + 2)) return false;   // 문 앞 두 칸
    if (h.mid !== mid && inRect(h, x, y, BAND)) return false;             // 다른 집 띠와 겹치는 칸은 아무도 못 씀
  }
  return ctx.walkTile(x, y) && !ctx.staticBlocked(x, y) && !ctx.reserved.has(key(x, y));
}

// 마당 물건이 섬에서 차지하는 칸(집 위치 기준). 잘못된 기록이면 null
export function yardCells(defs, house, f) {
  if (!record(f) || f.state !== "placed" || f.room !== "yard" || !integer(f.x) || !integer(f.y)) return null;
  const rot = integer(f.rot) && f.rot >= 0 && f.rot <= 3 ? f.rot : 0, s = sizeOf(defs, f, rot); if (!s) return null;
  const out = [];
  for (let dy = 0; dy < s[1]; dy++) for (let dx = 0; dx < s[0]; dx++) out.push([house.x + f.x - OFF + dx, house.y + f.y - OFF + dy]);
  return out;
}

// 지금 집 자리에서 보이는(유효한) 마당 물건 목록 — 그리기·충돌·꽃이 모두 이것만 쓴다(같은 층 겹침은 id 순서로 앞 것만)
export function validYard(defs, player, mid, ctx) {
  const house = ctx.houses.find(h => h.mid === mid);
  if (!house || !record(player) || !record(player.furn)) return [];
  const used = { yard: new Set(), path: new Set() }, out = [];
  for (const id of Object.keys(player.furn).sort()) {
    const f = player.furn[id]; if (!record(f) || f.room !== "yard" || !isYardType(defs, f.type)) continue;
    const cells = yardCells(defs, house, f); if (!cells) continue;
    const L = layerOf(defs, f.type);
    if (!cells.every(([x, y]) => yardCellOk(ctx, mid, x, y) && !used[L].has(key(x, y)))) continue;
    for (const [x, y] of cells) used[L].add(key(x, y));
    out.push({ id, f, cells, layer: L, solid: solidType(defs, f.type), mid });
  }
  return out;
}
// 놓였지만 지금 자리에서 안 보이는 것(집을 옮겨 자리가 없어짐 등)
export function hiddenYard(defs, player, mid, ctx) {
  const shown = new Set(validYard(defs, player, mid, ctx).map(v => v.id));
  return Object.entries(record(player?.furn) ? player.furn : {}).filter(([id, f]) => record(f) && f.state === "placed" && f.room === "yard" && !shown.has(id)).map(([id]) => id);
}

// 둘레 창 안에서 막히지 않은 칸끼리 바깥 테두리에서 닿는 칸들
function reach(x0, y0, x1, y1, free) {
  const seen = new Set(), q = [];
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (free(x, y)) { const k = key(x, y); if (!seen.has(k)) { seen.add(k); q.push([x, y]); } }
  for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if (free(x, y)) { const k = key(x, y); if (!seen.has(k)) { seen.add(k); q.push([x, y]); } }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
      const k = key(nx, ny); if (!seen.has(k) && free(nx, ny)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return seen;
}

// 놓기 검사. solidOthers = 다른 가족 마당 때문에 막힌 칸(Set "x,y") — 내 것은 이 player에서 다시 계산(⑦ 트랜잭션 재시도에도 최신), avoid = 사람이 서 있는 칸(Set)
export function canPlaceYard(defs, player, mid, ctx, furnId, x, y, rot, solidOthers = new Set(), avoid = new Set()) {
  if (!record(player) || !record(player.furn) || !Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  const f = player.furn[furnId];
  if (!record(f) || !["stored", "placed"].includes(f.state) || !isYardType(defs, f.type)) return fail("마당 물건 아님");
  if (!integer(x) || !integer(y) || !integer(rot) || rot < 0 || rot > 3) return fail("잘못된 위치");
  const house = ctx.houses.find(h => h.mid === mid); if (!house) return fail("집 없음");
  const cells = yardCells(defs, house, { ...f, state: "placed", room: "yard", x, y, rot });
  if (!cells) return fail("잘못된 가구 정의");
  if (!cells.every(([cx, cy]) => yardCellOk(ctx, mid, cx, cy))) return fail("마당 밖");
  const L = layerOf(defs, f.type);
  const mine = validYard(defs, player, mid, ctx).filter(v => v.id !== furnId);
  const same = new Set(mine.filter(v => v.layer === L).flatMap(v => v.cells.map(([a, b]) => key(a, b))));
  if (cells.some(([a, b]) => same.has(key(a, b)))) return fail("다른 것과 겹침");
  if (!solidType(defs, f.type)) return { ok: true, reason: null };
  if (cells.some(([a, b]) => avoid.has(key(a, b)))) return fail("사람이 서 있는 자리");
  // 가둠 검사: 집 둘레 창(띠+2칸) 안에서, 전에 바깥과 이어지던 빈칸이 놓은 뒤에도 이어져야 한다
  const own = mine.filter(v => v.solid).flatMap(v => v.cells.map(([a, b]) => key(a, b)));
  const base = new Set([...solidOthers, ...own]);
  const open = (a, b) => ctx.walkTile(a, b) && !ctx.staticBlocked(a, b) && !ctx.houses.some(h => inRect(h, a, b) && !(a === h.door.x && b === h.door.y)) && !base.has(key(a, b));
  const x0 = house.x - BAND - 2, y0 = house.y - BAND - 2, x1 = house.x + house.w + BAND + 1, y1 = house.y + house.h + BAND + 1;
  const before = reach(x0, y0, x1, y1, open);
  const placed = new Set(cells.map(([a, b]) => key(a, b)));
  const after = reach(x0, y0, x1, y1, (a, b) => open(a, b) && !placed.has(key(a, b)));
  for (const k of before) if (!placed.has(k) && !after.has(k)) return fail("길 막힘");
  return { ok: true, reason: null };
}

// 놓기(개인 트랜잭션 안에서). pr = 꽃을 심은 회차(이 회차가 지나야 섞여 핌)
export function placeYard(defs, player, mid, ctx, furnId, x, y, rot, round, solidOthers, avoid) {
  if (!record(player) || !integer(player.rev)) return fail("잘못된 플레이어");
  const chk = canPlaceYard(defs, player, mid, ctx, furnId, x, y, rot, solidOthers, avoid);
  if (!chk.ok) return chk;
  const prev = player.furn[furnId];
  if (prev.state === "placed" && prev.room === "yard" && prev.x === x && prev.y === y && (prev.rot || 0) === rot) return { ok: true, player, changed: false };
  const next = { type: prev.type, state: "placed", room: "yard", x, y, rot };
  if (integer(prev.tint)) next.tint = prev.tint;
  if (record(defs[prev.type]) && defs[prev.type].flower) next.pr = Number(round);
  return { ok: true, changed: true, player: { ...player, furn: { ...player.furn, [furnId]: next }, rev: player.rev + 1 } };
}
