import { fnv1a32 } from './forage.js';
import { campHour } from './campfire.js';
import { removeItems } from './inventory.js';
import { validPlayer, keyId, fail, done, unchanged, finish, countDex, record } from './playerOps.js';

export const INSECT_SLOT_MS = 600000;
export const insectSlot = ms => Math.floor(ms / INSECT_SLOT_MS);
export const timeBand = ms => campHour(ms) >= 6 && campHour(ms) < 18 ? 'day' : campHour(ms) < 20 && campHour(ms) >= 18 ? 'evening' : 'night';
const weight = { common: 6, normal: 3, rare: 1 };
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function spawnInsects(def, fid, mid, slot, band, max = 12) {
  const seed = cand => `${def.ver}|${fid}|${mid}|${slot}|${cand.id}`;
  const species = Object.entries(def.species).sort(([a], [b]) => compare(a, b));
  const candidates = def.candidates.map(cand => ({ cand, hash: fnv1a32(seed(cand)), options: species.filter(([, s]) => s.bands.includes(band) && s.places.includes(cand.place)) }))
    .filter(c => c.options.length).sort((a, b) => a.hash - b.hash || compare(a.cand.id, b.cand.id));
  const limit = Math.max(0, Math.min(12, Math.floor(max)));
  const chosen = candidates.slice(0, limit);
  const result = chosen.map(({ cand, options }) => {
    let roll = fnv1a32(seed(cand) + '|species') % options.reduce((sum, [, s]) => sum + weight[s.rarity], 0);
    let selected = options[0][0];
    for (const [id, s] of options) { selected = id; roll -= weight[s.rarity]; if (roll < 0) break; }
    return { id: `v${def.ver}_${slot}_${cand.id}`, cand: cand.id, species: selected, x: cand.x, y: cand.y };
  });
  const name = band === 'day' ? '배추흰나비' : band === 'night' ? '애반딧불이' : null;
  const guaranteed = species.find(([, s]) => s.name === name && s.bands.includes(band));
  if (limit && guaranteed && !result.some(i => i.species === guaranteed[0])) {
    const c = candidates.find(c => c.options.some(([id]) => id === guaranteed[0]));
    if (c) {
      const inst = { id: `v${def.ver}_${slot}_${c.cand.id}`, cand: c.cand.id, species: guaranteed[0], x: c.cand.x, y: c.cand.y };
      const index = result.findIndex(i => i.cand === c.cand.id);
      result[index >= 0 ? index : result.length - 1] = inst;
    }
  }
  return result;
}

function visitFor(player, slot) {
  if (!Number.isSafeInteger(slot) || slot < 0 || (player.insectVisit !== undefined && !record(player.insectVisit))) return null;
  const old = player.insectVisit ?? {};
  if (old.slot !== undefined && (!Number.isSafeInteger(old.slot) || old.slot > slot)) return null;
  if (old.slot === slot) {
    if ((old.caught !== undefined && !record(old.caught)) || (old.fled !== undefined && !record(old.fled))) return null;
    return { slot, caught: { ...old.caught }, fled: { ...old.fled } };
  }
  return { slot, caught: {}, fled: {} };
}
const instanceIn = (id, slot) => typeof id === 'string' && new RegExp(`^v1_${slot}_i[0-9]{3}$`).test(id);

export function applyCatch(player, inst, slot, reqId, at) {
  if (!validPlayer(player) || !keyId(reqId)) return fail('잘못된 요청');
  const visit = visitFor(player, slot);
  if (!visit || !instanceIn(inst?.id, slot)) return fail('새 곤충이 나타났어요');
  if (done(player, reqId) || visit.caught[inst.id]) return unchanged(player);
  if (!(player.inv.tool_net >= 1)) return fail('잠자리채가 필요해요');
  if (visit.fled[inst.id]) return fail('곤충이 떠났어요');
  if (typeof inst.species !== 'string' || !/^[a-z][a-z0-9_]*$/.test(inst.species)) return fail('잘못된 곤충');
  const insectDex = countDex(player.insectDex, inst.species, at);
  if (!insectDex) return fail('잘못된 기록');
  visit.caught[inst.id] = true;
  return finish(player, reqId, { insectVisit: visit, insectDex }, { [`insect_${inst.species}`]: 1 });
}

export function markFled(player, instId, slot) {
  if (!validPlayer(player)) return fail('잘못된 요청');
  const visit = visitFor(player, slot);
  if (!visit || !instanceIn(instId, slot)) return fail('새 곤충이 나타났어요');
  if (visit.caught[instId] || visit.fled[instId]) return unchanged(player);
  visit.fled[instId] = true;
  return finish(player, null, { insectVisit: visit });
}

export function releaseInsect(player, itemId, reqId) {
  if (!validPlayer(player) || !keyId(reqId)) return fail('잘못된 요청');
  if (done(player, reqId)) return unchanged(player);
  if (typeof itemId !== 'string' || !/^insect_[a-z][a-z0-9_]*$/.test(itemId)) return fail('곤충이 아니에요');
  const removed = removeItems(player.inv, { [itemId]: 1 });
  return removed.ok ? finish(player, reqId, { inv: removed.inv }) : removed;
}
