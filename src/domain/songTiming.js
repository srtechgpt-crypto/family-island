const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(note) {
  const m = typeof note === 'string' && /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!m) throw new TypeError('잘못된 음');
  const midi = (Number(m[3]) + 1) * 12 + SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}
export function songDurationMs(song) {
  return song.notes.reduce((sum, [, beats]) => sum + beats * song.beatMs, 0);
}
export function notesFrom(song, startAt, nowMs) {
  let offset = startAt - nowMs;
  const result = [];
  song.notes.forEach(([note, beats], i) => {
    const durMs = beats * song.beatMs;
    if (offset + durMs > 0) result.push({ i, freq: noteFreq(note), startOffsetMs: offset, durMs });
    offset += durMs;
  });
  return result;
}
