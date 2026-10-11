import { removeItems } from "./inventory.js";

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const id = value => typeof value === "string" && value.length > 0;

// recipes[recipeId] = { type: 가구종류ID, items: { 재료ID: 수량 } }
export function craft(player, recipeId, recipes, newFurnId, reqId) {
  if (!record(player) || !record(player.inv) || !record(player.furn) || !record(player.done)
    || !Number.isSafeInteger(player.rev) || player.rev < 0 || !id(reqId)) {
    return { ok: false, reason: "잘못된 제작 요청" };
  }
  if (Object.hasOwn(player.done, reqId) && player.done[reqId] === true) {
    return { ok: true, player, changed: false };
  }
  if (!record(recipes) || !id(recipeId) || !Object.hasOwn(recipes, recipeId)) {
    return { ok: false, reason: "없는 제작법" };
  }
  const recipe = recipes[recipeId];
  if (!record(recipe) || !id(recipe.type) || !record(recipe.items)) return { ok: false, reason: "잘못된 제작법" };
  if (!id(newFurnId)) return { ok: false, reason: "잘못된 가구 ID" };
  if (Object.hasOwn(player.furn, newFurnId)) return { ok: false, reason: "가구 ID 중복" };
  if (!Number.isSafeInteger(player.rev + 1)) return { ok: false, reason: "잘못된 플레이어" };
  const removed = removeItems(player.inv, recipe.items);
  if (!removed.ok) return removed;
  return {
    ok: true,
    player: {
      ...player,
      inv: removed.inv,
      furn: { ...player.furn, [newFurnId]: { type: recipe.type, state: "stored" } },
      done: { ...player.done, [reqId]: true },
      rev: player.rev + 1,
    },
    changed: true,
  };
}
