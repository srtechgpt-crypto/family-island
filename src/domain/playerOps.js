import { addItems } from './inventory.js';

export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const keyId = value => typeof value === 'string' && /^[^.#$\[\]/\u0000-\u001f\u007f]{1,40}$/.test(value);
export const fail = reason => ({ ok: false, reason });
export const unchanged = player => ({ ok: true, player, changed: false });
export const validPlayer = player => record(player) && record(player.inv)
  && (player.done === undefined || record(player.done))
  && Number.isSafeInteger(player.rev) && player.rev >= 0 && Number.isSafeInteger(player.rev + 1);
export const done = (player, req) => Object.hasOwn(player.done ?? {}, req) && player.done[req] === true;

export function finish(player, req, fields, rewards = {}) {
  const added = addItems(fields.inv ?? player.inv, rewards);
  if (!added.ok) return added;
  return { ok: true, changed: true, player: {
    ...player, ...fields, inv: added.inv, rev: player.rev + 1,
    ...(req ? { done: { ...player.done, [req]: true } } : {}),
  } };
}

export function countDex(dex, id, at) {
  const previous = Object.hasOwn(dex ?? {}, id) ? dex[id] : undefined;
  if (!Number.isSafeInteger(at) || (dex !== undefined && !record(dex))) return null;
  if (previous !== undefined && (!record(previous) || !Number.isFinite(previous.firstAt)
    || !Number.isSafeInteger(previous.count) || previous.count < 1)) return null;
  const count = (previous?.count ?? 0) + 1;
  if (!Number.isSafeInteger(count)) return null;
  return { ...dex, [id]: { firstAt: previous?.firstAt ?? at, count } };
}
