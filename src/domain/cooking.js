import { removeItems } from './inventory.js';
import { validPlayer, keyId, fail, done, unchanged, finish, countDex, record } from './playerOps.js';

export function cook(player, recipeId, cooking, items, reqId) {
  if (!validPlayer(player) || !keyId(reqId)) return fail('잘못된 요청');
  if (done(player, reqId)) return unchanged(player);
  const recipe = Object.hasOwn(cooking?.recipes ?? {}, recipeId) ? cooking.recipes[recipeId] : null;
  if (!record(recipe?.items) || items?.[recipe.out]?.kind !== 'food') return fail('없는 요리');
  // Reserve explicit ingredients first so a kind selector never consumes them twice.
  const explicit = Object.fromEntries(Object.entries(recipe.items).filter(([id]) => !id.startsWith('kind:')));
  const reserved = removeItems(player.inv, explicit);
  if (!reserved.ok && !reserved.missing) return reserved;
  const missing = { ...reserved.missing }, selected = { ...explicit };
  for (const [selector, quantity] of Object.entries(recipe.items)) {
    if (!selector.startsWith('kind:')) continue;
    if (selector !== 'kind:fish' || !Number.isSafeInteger(quantity) || quantity < 1) return fail('잘못된 요리법');
    let left = quantity;
    for (const id of Object.keys(items).sort()) {
      if (items[id].kind !== 'fish') continue;
      const held = Object.hasOwn(player.inv, id) ? player.inv[id] : 0;
      if (!Number.isSafeInteger(held) || held < 0) return fail('잘못된 수량');
      const take = Math.min(left, Math.max(0, held - (selected[id] ?? 0)));
      if (take) selected[id] = (selected[id] ?? 0) + take;
      left -= take;
      if (!left) break;
    }
    if (left) missing[selector] = left;
  }
  if (Object.keys(missing).length) return { ok: false, reason: '재료가 부족해요', missing };
  const removed = removeItems(player.inv, selected);
  if (!removed.ok) return removed;
  return finish(player, reqId, { inv: removed.inv }, { [recipe.out]: 1 });
}

export function eat(player, itemId, items, reqId, at) {
  if (!validPlayer(player) || !keyId(reqId)) return fail('잘못된 요청');
  if (done(player, reqId)) return unchanged(player);
  if (items?.[itemId]?.kind !== 'food') return fail('음식이 아니에요');
  const removed = removeItems(player.inv, { [itemId]: 1 });
  if (!removed.ok) return removed;
  const cookDex = countDex(player.cookDex, itemId, at);
  if (!cookDex) return fail('잘못된 기록');
  return finish(player, reqId, { inv: removed.inv, cookDex });
}
