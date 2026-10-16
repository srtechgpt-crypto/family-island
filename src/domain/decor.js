// 버전 12 꾸미기 계산(순수 함수): 벽지·바닥, 가구 색칠, 전시, 세트 보상, 대회 상품, 날짜·주 번호
const record = v => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = Number.isSafeInteger;
const fail = reason => ({ ok: false, reason });
const validRev = p => record(p) && integer(p.rev) && p.rev >= 0 && record(p.furn) && record(p.inv) && record(p.done);
export const ROOM_IDS = ["living", "bed", "small", "up", "study", "attic"];
export const MAX_STYLE = 15, MAX_TINT = 7;

// KST 일 번호 / KST 주 번호(월요일 시작: 1970-01-01은 목요일 → +3일)
export const kstDay = ms => Math.floor((ms + 32400000) / 86400000);
export const kstWeek = ms => Math.floor((kstDay(ms) + 3) / 7);
export const weekKey = wk => "w" + wk;

// 이 방의 벽지·바닥 번호(없거나 잘못되면 0 = 기본)
export function roomStyleOf(player, roomId, decor) {
  const s = record(player) && record(player.roomStyle) && record(player.roomStyle[roomId]) ? player.roomStyle[roomId] : {};
  const ok = (v, list) => integer(v) && v >= 0 && v < list.length ? v : 0;
  return { wall: ok(s.wall, decor.walls), floor: ok(s.floor, decor.floors) };
}
// 이 번호를 쓸 수 있나(0번 = 누구나, 나머지는 그 두루마리를 1개 이상 가짐)
export function ownsStyle(player, kind, idx, decor) {
  const list = kind === "wall" ? decor.walls : decor.floors;
  if (!integer(idx) || idx < 0 || idx >= list.length) return false;
  return idx === 0 || ((record(player.inv) && player.inv[list[idx].id]) || 0) > 0;
}
export function setRoomStyle(player, roomId, kind, idx, decor) {
  if (!validRev(player)) return fail("잘못된 플레이어");
  if (!ROOM_IDS.includes(roomId) || !["wall", "floor"].includes(kind)) return fail("잘못된 방");
  if (!ownsStyle(player, kind, idx, decor)) return fail("아직 없는 무늬");
  const cur = roomStyleOf(player, roomId, decor);
  if (cur[kind] === idx) return { ok: true, player, changed: false };
  const roomStyle = { ...(record(player.roomStyle) ? player.roomStyle : {}), [roomId]: { ...cur, [kind]: idx } };
  return { ok: true, player: { ...player, roomStyle, rev: player.rev + 1 }, changed: true };
}

// 가구 색칠: 물감 1개(paints = farm.json dyes 순서, 번호 = tint). tint -1 = 원래 색(물감 안 씀)
export function paintFurn(player, furnId, tint, paints, defs) {
  if (!validRev(player) || !Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  const f = player.furn[furnId];
  if (!record(f)) return fail("잘못된 가구");
  if (defs && record(defs[f.type]) && defs[f.type].flower) return fail("꽃은 색칠할 수 없어요");
  if (tint === -1) {
    if (!integer(f.tint)) return { ok: true, player, changed: false };
    const { tint: _, ...rest } = f;
    return { ok: true, player: { ...player, furn: { ...player.furn, [furnId]: rest }, rev: player.rev + 1 }, changed: true };
  }
  if (!integer(tint) || tint < 0 || tint >= paints.length || tint > MAX_TINT) return fail("없는 색");
  if (f.tint === tint) return { ok: true, player, changed: false };
  const item = "paint_" + paints[tint].id, have = player.inv[item] || 0;
  if (have < 1) return fail("물감이 없어요");
  const inv = { ...player.inv }; if (have === 1) delete inv[item]; else inv[item] = have - 1;
  return { ok: true, player: { ...player, inv, furn: { ...player.furn, [furnId]: { ...f, tint } }, rev: player.rev + 1 }, changed: true };
}

// 전시: 어항(fish)·물고기 액자(fish)·곤충 액자(insect)에 도감에 있는 것만
export const showKind = (defs, type) => record(defs[type]) ? (defs[type].show || (type === "fish_tank" ? "fish" : null)) : null;
export function showable(player, kind) {
  if (kind === "fish") return Object.keys(record(player.dex) ? player.dex : {}).sort();
  if (kind === "insect") return Object.keys(record(player.insectDex) ? player.insectDex : {}).map(k => "insect_" + k).sort();
  return [];
}
export function setShow(player, furnId, what, defs) {
  if (!validRev(player) || !Object.hasOwn(player.furn, furnId)) return fail("주인 아님");
  const f = player.furn[furnId], kind = record(f) && showKind(defs, f.type);
  if (!kind) return fail("전시할 수 없는 가구");
  if (what === null) {
    if (typeof f.show !== "string") return { ok: true, player, changed: false };
    const { show: _, ...rest } = f;
    return { ok: true, player: { ...player, furn: { ...player.furn, [furnId]: rest }, rev: player.rev + 1 }, changed: true };
  }
  if (!showable(player, kind).includes(what) || !/^[a-z_]{2,30}$/.test(what)) return fail("도감에 없어요");
  if (f.show === what) return { ok: true, player, changed: false };
  return { ok: true, player: { ...player, furn: { ...player.furn, [furnId]: { ...f, show: what } }, rev: player.rev + 1 }, changed: true };
}

// 세트: 그 종류 가구를 하나씩 모두 가졌나(놓았든 넣었든)
export function setProgress(player, set) {
  const have = new Set(Object.values(record(player.furn) ? player.furn : {}).filter(record).map(f => f.type));
  return { have: set.types.filter(t => have.has(t)), done: set.types.every(t => have.has(t)), got: !!(record(player.done) && player.done["s_" + set.id]) };
}
export function claimSet(player, set, reward) {
  if (!validRev(player)) return fail("잘못된 플레이어");
  const pr = setProgress(player, set);
  if (pr.got) return { ok: true, player, changed: false };
  if (!pr.done) return fail("아직 다 못 모았어요");
  const fid = "f_s_" + set.id;
  if (Object.hasOwn(player.furn, fid)) return fail("가구 ID 중복");
  return { ok: true, changed: true, player: { ...player, done: { ...player.done, ["s_" + set.id]: true }, furn: { ...player.furn, [fid]: { type: reward, state: "stored" } }, rev: player.rev + 1 } };
}

// 대회: 지난주 표 세기 → 1등(동점 모두). entries = {mid: {room}}, votes = {voter: mid}
export function contestResult(entries, votes) {
  const e = record(entries) ? entries : {}, v = record(votes) ? votes : {};
  const count = {};
  for (const [voter, to] of Object.entries(v)) if (typeof to === "string" && to !== voter && record(e[to])) count[to] = (count[to] || 0) + 1;
  const best = Math.max(0, ...Object.values(count));
  return { count, winners: best > 0 ? Object.keys(count).filter(m => count[m] === best).sort() : [] };
}
export function claimContest(player, wk, mid, entries, votes, reward) {
  if (!validRev(player)) return fail("잘못된 플레이어");
  const key = "c_" + wk;
  if (player.done[key]) return { ok: true, player, changed: false };
  if (!contestResult(entries, votes).winners.includes(mid)) return fail("1등이 아니에요");
  const fid = "f_c_" + wk;
  if (Object.hasOwn(player.furn, fid)) return fail("가구 ID 중복");
  return { ok: true, changed: true, player: { ...player, done: { ...player.done, [key]: true }, furn: { ...player.furn, [fid]: { type: reward, state: "stored" } }, rev: player.rev + 1 } };
}

// 하트: 오늘 아직 안 눌렀나 / 다음 값
export function heartNext(cur, day) {
  const n = record(cur) && integer(cur.n) ? cur.n : 0, d = record(cur) && integer(cur.day) ? cur.day : -1;
  if (d >= day) return null;
  return { n: n + 1, day };
}
export const heartTotal = list => Object.values(record(list) ? list : {}).reduce((s, v) => s + (record(v) && integer(v.n) ? v.n : 0), 0);
