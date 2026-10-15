// 버전 11 가족이 함께 섬 키우기 — 순수 계산
// 공사 재료는 사람별 누적(isle/give/{pid}/{mid}/{item}), 합계·완성은 저장하지 않고 계산한다.
// 넣기는 v8 들어주기처럼 "한 번의 묶음 쓰기"(내 가방 −q · rev+1 · 내 누적 +q). 계약: docs/데이터구조.md "버전 11"
import { removeItems } from './inventory.js';
import { record, validPlayer, fail, unchanged, finish } from './playerOps.js';

export const MIDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];
const POND = 5, BRIDGE = 6;
const nat = v => Number.isSafeInteger(v) && v > 0;

// ---- 지도: 연못 고리(숲섬) ----
export const inOuter = (p, x, y) => ((x + 0.5 - p.cx) / p.RX) ** 2 + ((y + 0.5 - p.cy) / p.RY) ** 2 <= 1;
export const inIsle = (p, x, y) => ((x + 0.5 - p.cx) / p.rx) ** 2 + ((y + 0.5 - p.cy) / p.ry) ** 2 <= 1;   // 숲섬 안쪽 땅
export function ringCells(isle) {
  const p = isle.pond, out = [];
  for (let y = Math.floor(p.cy - p.RY) - 1; y <= Math.ceil(p.cy + p.RY) + 1; y++)
    for (let x = Math.floor(p.cx - p.RX) - 1; x <= Math.ceil(p.cx + p.RX) + 1; x++)
      if (inOuter(p, x, y) && !inIsle(p, x, y)) out.push({ x, y });
  return out;
}
// 지도 칸 배열을 고친다(모든 폰이 같은 결과): 고리 = 연못, 다리 칸 = 다리가 완성됐으면 다리 아니면 연못. 바뀐 칸 수를 돌려줌
export function applyPond(tiles, w, isle, bridgeBuilt) {
  let changed = 0;
  const set = (x, y, t) => { const i = y * w + x; if (tiles[i] !== t) { tiles[i] = t; changed++; } };
  for (const c of ringCells(isle)) set(c.x, c.y, POND);
  for (const c of isle.bridge) set(c.x, c.y, bridgeBuilt ? BRIDGE : POND);
  return changed;
}
// 숲 채집 칸(30분 회차 밭과 같은 모양) — 지도 고정, 다리 완성 여부와 무관하게 같은 id
export function forestField(isle) {
  const f = isle.forest;
  return { id: f.id, name: f.name, cells: f.cells.map(([x, y], i) => ({ id: `v11_forest_${String(i + 1).padStart(2, '0')}`, x, y, item: f.items[i % f.items.length] })) };
}

// ---- 진행 ----
// gives = isle/give 값({pid: {mid: {item: n}}}) → 공사 하나의 합계·사람별·완성
export function progress(gives, project) {
  const g = record(gives) && record(gives[project.id]) ? gives[project.id] : {};
  const have = {}, by = {};
  for (const item of Object.keys(project.need)) have[item] = 0;
  for (const mid of MIDS) {
    const row = record(g[mid]) ? g[mid] : {};
    for (const item of Object.keys(project.need)) {
      const n = nat(row[item]) ? row[item] : 0;
      if (!n) continue;
      have[item] += n; by[mid] = (by[mid] || 0) + n;
    }
  }
  const done = Object.entries(project.need).every(([item, need]) => have[item] >= need);
  const total = Object.values(project.need).reduce((a, b) => a + b, 0);
  const got = Object.entries(project.need).reduce((a, [item, need]) => a + Math.min(need, have[item]), 0);
  return { have, by, done, pct: total ? Math.floor(got * 100 / total) : 100 };
}
// 완성된 공사 id 집합(차례대로: 앞 공사가 안 끝났으면 뒤 공사는 넘쳐도 완성으로 치지 않음)
export function builtSet(gives, isle) {
  const out = new Set();
  for (const p of isle.projects) { if (!progress(gives, p).done) break; out.add(p.id); }
  return out;
}
// 지금 재료를 넣을 공사(앞 공사가 다 끝난 첫 미완성) — 다 끝났으면 null
export function currentProject(gives, isle) {
  const b = builtSet(gives, isle);
  return isle.projects.find(p => !b.has(p.id)) || null;
}

// ---- 넣기 묶음 쓰기 ----
// 남은 양·내 가방만큼 줄여서 넣는다. now는 쓰지 않음(규칙이 값 차이로 검사)
export function donatePatch(player, mid, gives, isle, pid, item, want) {
  if (!validPlayer(player) || !MIDS.includes(mid)) return fail('잘못된 데이터');
  const cur = currentProject(gives, isle);
  if (!cur) return fail('공사가 모두 끝났어요');
  if (cur.id !== pid) return fail('지금은 다른 공사를 하고 있어요');
  if (!Object.hasOwn(cur.need, item)) return fail('이 공사에 필요 없는 재료예요');
  if (!nat(want)) return fail('개수를 골라 주세요');
  const pr = progress(gives, cur), left = cur.need[item] - pr.have[item];
  if (left <= 0) return fail('이 재료는 벌써 다 찼어요');
  const mine = nat(player.inv[item]) ? player.inv[item] : 0;
  if (!mine) return fail('가방에 없어요');
  const q = Math.min(want, left, mine);
  const removed = removeItems(player.inv, { [item]: q });
  if (!removed.ok) return fail('물건이 모자라요');
  const prev = record(gives?.[pid]?.[mid]) && nat(gives[pid][mid][item]) ? gives[pid][mid][item] : 0;
  return { ok: true, q, patch: {
    [`players/${mid}/inv/${item}`]: removed.inv[item] ?? null,
    [`players/${mid}/rev`]: player.rev + 1,
    [`isle/give/${pid}/${mid}/${item}`]: prev + q,
  } };
}

// ---- 기념 가구(개인 트랜잭션, 공사마다 한 번) ----
export const rewardKey = pid => `i_${pid}`;
export function payIsle(player, project) {
  if (!validPlayer(player) || !record(player.furn) || !project || typeof project.reward !== 'string') return fail('잘못된 요청');
  const key = rewardKey(project.id), fid = `f_i_${project.id}`;
  if (Object.hasOwn(player.done ?? {}, key) && player.done[key] === true) return unchanged(player);
  if (Object.hasOwn(player.furn, fid)) return finish(player, key, {});   // 가구는 있는데 표식만 없으면 표식만
  return finish(player, key, { furn: { ...player.furn, [fid]: { type: project.reward, state: 'stored' } } });
}

// 규칙에 넣을 허용 목록·필요량(시험이 규칙과 같은지 확인)
export function ruleTable(isle) {
  return Object.fromEntries(isle.projects.map(p => [p.id, { ...p.need }]));
}
