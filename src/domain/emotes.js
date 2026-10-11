export const EMOTE_KINDS = ["wave", "heart", "dance"];
export const EMOTE_MS = 3000;

export function emoteProgress(emote, nowMs) {
  if (!emote || !EMOTE_KINDS.includes(emote.kind) || !Number.isFinite(emote.at) || !Number.isFinite(nowMs)) return null;
  const elapsed = nowMs - emote.at;
  return elapsed >= 0 && elapsed < EMOTE_MS ? elapsed / EMOTE_MS : null;
}
