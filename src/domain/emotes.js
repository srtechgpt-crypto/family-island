export const EMOTE_GROUPS = Object.freeze({
  face: Object.freeze(["heart", "laugh", "surprise", "sad", "angry", "sleepy", "curious", "idea", "thanks"]),
  action: Object.freeze(["wave", "clap", "bow", "jump", "spin", "sit", "thumbs_up", "peace"]),
  dance: Object.freeze(["dance", "robot", "ballet", "bunny", "freestyle"]),
});
export const EMOTE_KINDS = Object.freeze([...EMOTE_GROUPS.face, ...EMOTE_GROUPS.action, ...EMOTE_GROUPS.dance, "yum"]);
export const FACE_KINDS = Object.freeze([...EMOTE_GROUPS.face, "yum"]);
export const EMOTE_MS = 3000;

export function emoteMs(kind) {
  if (!EMOTE_KINDS.includes(kind)) return null;
  if (kind === "sit") return 30000;
  return EMOTE_GROUPS.dance.includes(kind) ? 5000 : EMOTE_MS;
}

// 유효한 재생 구간의 경과 밀리초. 미래·만료·잘못된 입력은 그리지 않는다.
export function emoteElapsed(emote, nowMs) {
  if (!emote || !EMOTE_KINDS.includes(emote.kind) || !Number.isFinite(emote.at) || !Number.isFinite(nowMs)) return null;
  const elapsed = nowMs - emote.at;
  return elapsed >= 0 && elapsed < emoteMs(emote.kind) ? elapsed : null;
}

export function emoteProgress(emote, nowMs) {
  const elapsed = emoteElapsed(emote, nowMs);
  return elapsed === null ? null : elapsed / emoteMs(emote.kind);
}

// movedSince는 호출부가 시작 뒤 0.3칸 초과 이동을 기억한 값. t의 단위는 ms.
export function emoteActive(emote, nowMs, { movedSince = false, boat = false } = {}) {
  const t = emoteElapsed(emote, nowMs);
  if (t === null || ((movedSince || boat) && !FACE_KINDS.includes(emote.kind))) return null;
  return { kind: emote.kind, p: t / emoteMs(emote.kind), t };
}
