// 버전 8 옷 만들기: 옷감 1 + 물감 1 → 무늬 윗옷 1벌 (개인 트랜잭션, 같은 req는 한 번만) — 순수 계산
import { removeItems, addItems } from './inventory.js';
import { validPlayer, fail, unchanged, done } from './playerOps.js';
import { OUTFIT_RE } from './appearance.js';

export const PATTERNS = ['plain', 'stripe', 'dot'];
export const DYES = ['red', 'yellow', 'white', 'green', 'orange', 'pink'];
export const outfitId = (pattern, dye) => `outfit_${pattern}_${dye}`;
export const sewCost = dye => ({ cloth: 1, ['paint_' + dye]: 1 });

// "outfit_dot_pink" → { pattern: 'dot', dye: 'pink' } / 잘못된 값이면 null
export function parseOutfit(id) {
  const m = typeof id === 'string' ? OUTFIT_RE.exec(id) : null;
  return m ? { pattern: m[1], dye: m[2] } : null;
}

export function sewOutfit(player, pattern, dye, req) {
  if (!validPlayer(player) || typeof req !== 'string' || !/^w_[a-z2-9]{10}$/.test(req)) return fail('잘못된 요청');
  if (!PATTERNS.includes(pattern) || !DYES.includes(dye)) return fail('없는 옷');
  if (done(player, req)) return unchanged(player);
  const removed = removeItems(player.inv, sewCost(dye));
  if (!removed.ok) return { ...fail('재료가 모자라요'), missing: removed.missing };
  const added = addItems(removed.inv, { [outfitId(pattern, dye)]: 1 });
  if (!added.ok) return added;
  return { ok: true, changed: true, player: { ...player, inv: added.inv, done: { ...player.done, [req]: true }, rev: player.rev + 1 } };
}

// 옷장 '옷 만들기' 안내: 무엇이 모자라고 어디서 구하는지(아이 화면용)
export function sewHint(inv, dye) {
  const have = k => (inv && Number.isSafeInteger(inv[k]) ? inv[k] : 0);
  if (have('cloth') < 1) {
    if (have('thread') >= 2) return '작업대에서 실 2개로 옷감을 만들어요';
    if (have('wool') >= 2) return '작업대에서 양털 2개로 실을 만들어요';
    return '목장 양 우리에서 털을 깎아요 ✂️ (양털 → 실 → 옷감)';
  }
  if (have('paint_' + dye) < 1) {
    const src = { red: '빨간 꽃 2개', yellow: '노란 꽃 2개', white: '하얀 꽃 2개', green: '잡초 3개', orange: '빨강 물감 + 노랑 물감', pink: '빨강 물감 + 하양 물감' }[dye];
    return `작업대에서 ${src}로 물감을 만들어요`;
  }
  return null;
}
