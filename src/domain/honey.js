import { fnv1a32 } from './forage.js';
import { treeDropSpots } from './housing.js';

export function honeyTrees(trees, round, count = 3) {
  return trees.map(t => ({ id: typeof t === 'string' ? t : t.id })).map(t => ({ ...t, hash: fnv1a32(round + '|honey|' + t.id) }))
    .sort((a, b) => a.hash - b.hash || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, count)).map(t => t.id);
}
export function honeySpot(map, tree, fixed = {}) {
  const spots = treeDropSpots(map, tree, 4, fixed);
  return spots.at(-1) ?? null;
}
