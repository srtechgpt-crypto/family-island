const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const id = value => typeof value === "string" && value.length > 0;
const integer = Number.isSafeInteger;
const validRot = value => integer(value) && value >= 0 && value <= 3;
const fail = reason => ({ ok: false, reason });
const key = (x, y) => `${x},${y}`;
const validRev = player => record(player) && integer(player.rev) && player.rev >= 0;

function roomInfo(room) {
  if (!record(room) || !id(room.id) || !integer(room.w) || room.w < 3 || !integer(room.h) || room.h < 3) return null;
  const sets = {};
  for (const field of ["blocked", "door", "walkway"]) {
    if (!Array.isArray(room[field]) || !room[field].every(cell => Array.isArray(cell) && cell.length === 2
      && integer(cell[0]) && integer(cell[1]) && cell[0] >= 0 && cell[0] < room.w && cell[1] >= 0 && cell[1] < room.h)) return null;
    sets[field] = new Set(room[field].map(([x, y]) => key(x, y)));
  }
  if (!room.door.length || !room.door.every(([x, y]) => x > 0 && x < room.w - 1 && y === room.h - 1)
    || [...sets.door].some(cell => sets.blocked.has(cell))) return null;
  return sets;
}

function dimensions(defs, furniture, rot) {
  if (!record(defs) || !id(furniture.type) || !Object.hasOwn(defs, furniture.type)) return null;
  const def = defs[furniture.type];
  if (!record(def) || !integer(def.w) || !integer(def.h) || def.w < 1 || def.h < 1) return null;
  return rot % 2 === 0 ? [def.w, def.h] : [def.h, def.w];
}

function wall(room, info, x, y) {
  return x === 0 || x === room.w - 1 || y === 0 || (y === room.h - 1 && !info.door.has(key(x, y)));
}

function footprint(room, info, x, y, width, height) {
  if (x < 0 || y < 0 || x >= room.w || y >= room.h || width > room.w - x || height > room.h - y) return fail("방 밖");
  const cells = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const cell = key(x + dx, y + dy);
      if (info.door.has(cell)) return fail("문");
      if (wall(room, info, x + dx, y + dy)) return fail("벽");
      if (info.blocked.has(cell)) return fail("막힌 칸");
      if (info.walkway.has(cell)) return fail("통로");
      cells.push(cell);
    }
  }
  return { ok: true, cells };
}

// 문에서 4방향으로 걸어 닿는 빈칸 모음
function reachable(room, info, occupied) {
  const free = new Set();
  for (let y = 1; y < room.h; y++) {
    for (let x = 1; x < room.w - 1; x++) {
      const cell = key(x, y);
      // walkway는 예약된 보행 칸이므로 탐색에는 포함한다.
      if (!wall(room, info, x, y) && !info.blocked.has(cell) && !occupied.has(cell)) free.add(cell);
    }
  }
  const queue = [room.door[0]];
  const seen = new Set([key(...queue[0])]);
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const cell = key(nx, ny);
      if (free.has(cell) && !seen.has(cell)) { seen.add(cell); queue.push([nx, ny]); }
    }
  }
  return seen;
}

export function canPlace(room, furnDefs, player, furnId, x, y, rot) {
  if (!record(player) || !record(player.furn) || !id(furnId)) return fail("잘못된 플레이어");
  if (!Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  if (!integer(x) || !integer(y) || !validRot(rot)) return fail("잘못된 위치");
  const info = roomInfo(room);
  if (!info) return fail("잘못된 방");
  const furniture = player.furn[furnId];
  if (!record(furniture) || !["stored", "placed"].includes(furniture.state)) return fail("잘못된 가구");
  const size = dimensions(furnDefs, furniture, rot);
  if (!size) return fail("잘못된 가구 정의");
  const candidate = footprint(room, info, x, y, ...size);
  if (!candidate.ok) return fail(candidate.reason);
  const occupied = new Set();
  for (const [otherId, other] of Object.entries(player.furn)) {
    if (otherId === furnId) continue;
    if (!record(other) || !["stored", "placed"].includes(other.state)) return fail("잘못된 가구");
    if (other.state !== "placed" || other.room !== room.id) continue;
    if (!integer(other.x) || !integer(other.y) || !validRot(other.rot)) return fail("잘못된 가구");
    const otherSize = dimensions(furnDefs, other, other.rot);
    if (!otherSize) return fail("잘못된 가구 정의");
    const existing = footprint(room, info, other.x, other.y, ...otherSize);
    if (!existing.ok) return fail("잘못된 가구");
    for (const cell of existing.cells) occupied.add(cell);
  }
  if (candidate.cells.some(cell => occupied.has(cell))) return fail("다른 가구와 겹침");
  // 이미 고립된 빈칸(예: 탁자가 2칸→1칸으로 줄어 생긴 칸)은 탓하지 않고, 원래 닿던 칸을 새로 막을 때만 거절한다.
  const before = reachable(room, info, occupied);
  for (const cell of candidate.cells) occupied.add(cell);
  const after = reachable(room, info, occupied);
  const placed = new Set(candidate.cells);
  for (const cell of before) if (!placed.has(cell) && !after.has(cell)) return fail("길 막힘");
  return { ok: true, reason: null };
}

export function place(room, furnDefs, player, furnId, x, y, rot) {
  if (!validRev(player)) return fail("잘못된 플레이어");
  const checked = canPlace(room, furnDefs, player, furnId, x, y, rot);
  if (!checked.ok) return checked;
  const previous = player.furn[furnId];
  if (previous.state === "placed" && previous.room === room.id && previous.x === x && previous.y === y && previous.rot === rot) {
    return { ok: true, player, changed: false };
  }
  if (!integer(player.rev + 1)) return fail("잘못된 플레이어");
  return {
    ok: true,
    player: {
      ...player,
      furn: { ...player.furn, [furnId]: { type: previous.type, state: "placed", room: room.id, x, y, rot } },
      rev: player.rev + 1,
    },
    changed: true,
  };
}

export function store(player, furnId) {
  if (!validRev(player) || !record(player.furn) || !id(furnId)) return fail("잘못된 플레이어");
  if (!Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  const previous = player.furn[furnId];
  if (!record(previous) || !id(previous.type) || !["stored", "placed"].includes(previous.state)) return fail("잘못된 가구");
  if (previous.state === "stored") return { ok: true, player, changed: false };
  if (!integer(player.rev + 1)) return fail("잘못된 플레이어");
  return {
    ok: true,
    player: { ...player, furn: { ...player.furn, [furnId]: { type: previous.type, state: "stored" } }, rev: player.rev + 1 },
    changed: true,
  };
}

// place와 같은 인자 순서에서 좌표 대신 목표 rot를 받는다. 생략하면 시계 방향 90도.
export function rotate(room, furnDefs, player, furnId, rot) {
  if (!record(player) || !record(player.furn) || !id(furnId)) return fail("잘못된 플레이어");
  if (!Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  const previous = player.furn[furnId];
  if (!record(previous) || previous.state !== "placed") return fail("배치된 가구 아님");
  if (!record(room) || previous.room !== room.id) return fail("다른 방");
  if (!validRot(previous.rot)) return fail("잘못된 위치");
  const nextRot = rot === undefined ? (previous.rot + 1) % 4 : rot;
  return place(room, furnDefs, player, furnId, previous.x, previous.y, nextRot);
}
