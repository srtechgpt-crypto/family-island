import { addItems } from "./inventory.js";
import { pruneGatherApplied, RECOVER_MS } from './gather.js';

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const id = value => typeof value === "string" && value.length > 0;
const validPlayer = player => record(player) && record(player.inv) && record(player.applied)
  && Number.isSafeInteger(player.rev) && player.rev >= 0;
const validClaim = claim => record(claim) && id(claim.id) && id(claim.by) && id(claim.item)
  && Number.isSafeInteger(claim.qty) && claim.qty >= 0 && Number.isSafeInteger(claim.at);
const received = (player, claimId) => Object.hasOwn(player.applied, claimId)
  && (player.applied[claimId] === true || (claimId.startsWith('g_') && Number.isSafeInteger(player.applied[claimId]) && player.applied[claimId] >= 0));

export function applyClaim(player, claim, memberId, nowMs = claim?.at) {
  if (!validPlayer(player) || !record(claim) || !id(claim.id) || !id(memberId)) {
    return { ok: false, reason: "잘못된 보상" };
  }
  if (claim.by !== memberId) return { ok: false, reason: "주인 아님" };
  // 재전송은 수량/시간 등 나머지 본문을 다시 처리하지 않는다.
  if (received(player, claim.id)) return { ok: true, player, changed: false };
  if (!Number.isSafeInteger(claim.qty) || claim.qty < 0) return { ok: false, reason: "잘못된 수량" };
  if (!validClaim(claim)) return { ok: false, reason: "잘못된 보상" };
  if (!Number.isSafeInteger(nowMs) || nowMs < claim.at) return { ok: false, reason: "잘못된 지급 시각" };
  if (claim.id.startsWith('g_') && nowMs - claim.at > RECOVER_MS) return { ok: false, reason: '복구 기간이 지났어요' };
  if (!Number.isSafeInteger(player.rev + 1)) return { ok: false, reason: "잘못된 플레이어" };
  const added = addItems(player.inv, { [claim.item]: claim.qty });
  if (!added.ok) return added;
  let applied;
  try { applied = pruneGatherApplied(player.applied, nowMs); }
  catch { return { ok: false, reason: '잘못된 지급 목록' }; }
  if (claim.id.startsWith('g_') && !/^g_h[1-9][0-9]{7}_z[0-9]+_[0-9]+_[A-Za-z0-9_-]+$/.test(claim.id)) return { ok: false, reason: '잘못된 채집 ID' };
  return {
    ok: true,
    player: { ...player, inv: added.inv, applied: { ...applied, [claim.id]: claim.id.startsWith('g_') ? claim.at : true }, rev: player.rev + 1 },
    changed: true,
  };
}

export function pendingClaims(claims, player, memberId) {
  if (!Array.isArray(claims) || !validPlayer(player) || !id(memberId) || !claims.every(validClaim)) {
    throw new TypeError("잘못된 보상 목록");
  }
  return claims.filter(claim => claim.by === memberId && !received(player, claim.id)).map(claim => ({ ...claim }));
}
