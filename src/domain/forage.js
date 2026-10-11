export function fnv1a32(str) {
  let hash = 2166136261;
  // TextEncoder emits UTF-8 bytes, including replacement bytes for lone surrogates.
  for (const byte of new TextEncoder().encode(str)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash;
}

export function pickForage(candidates, round, count = 24) {
  return candidates.map(candidate => ({ candidate, hash: fnv1a32(round + "|" + candidate.id) }))
    .sort((a, b) => a.hash - b.hash || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0))
    .slice(0, Math.max(0, count)).map(entry => entry.candidate);
}
