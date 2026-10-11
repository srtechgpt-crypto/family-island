// 캠프 노래(v3): 직접 만든 음표를 웹 오디오로 합성. 서버 시각 startAt에 맞춰 각 폰이 예약
// 폰은 사용자가 화면을 한 번 눌러야 소리를 낼 수 있어서, 첫 터치 때 unlock()을 부른다
import { notesFrom } from "../domain/songTiming.js";

let ac = null, master = null, playing = null;
const MUTE_KEY = "familyIsland.mute";
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* 무시 */ }

export function unlock() {
  try {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination); }
    if (ac.state !== "running") ac.resume().catch(() => {});
  } catch { /* 소리 없는 기기 */ }
}
export function audioReady() { return !!ac && ac.state === "running"; }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* 무시 */ }
  if (master) master.gain.value = muted ? 0 : 0.8;
}

// 같은 노래 id는 한 번만 예약. nowMs = 서버 보정 현재 시각
export function playSong(id, song, startAt, nowMs) {
  if (!ac || ac.state !== "running" || (playing && playing.id === id)) return;
  stopSong();
  const notes = notesFrom(song, startAt, nowMs);
  if (!notes.length) return;
  const base = ac.currentTime, nodes = [];
  for (const n of notes) {
    const offset = Math.max(0, n.startOffsetMs) / 1000, dur = (n.durMs + Math.min(0, n.startOffsetMs)) / 1000;
    if (dur <= 0.03) continue;
    const at = base + offset + 0.05, o = ac.createOscillator(), gn = ac.createGain();
    o.type = "triangle"; o.frequency.value = n.freq;
    gn.gain.setValueAtTime(0, at); gn.gain.linearRampToValueAtTime(0.22, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.001, at + dur * 0.95);
    o.connect(gn).connect(master); o.start(at); o.stop(at + dur);
    nodes.push(o);
  }
  playing = { id, nodes };
}
export function stopSong() {
  if (!playing) return;
  for (const o of playing.nodes) { try { o.stop(); } catch { /* 이미 끝남 */ } }
  playing = null;
}
export function songPlayingId() { return playing && playing.id; }
