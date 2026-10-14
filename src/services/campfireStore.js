// 캠프파이어: 오늘(KST 일 번호) 실시간 상태 campfires/{day}와 추억 기록 camplog/{day}
import { db, ref, get, set, onValue, runTransaction, serverTimestamp, fpath, rid, serverNow } from "./fb.js";
import { kstDay } from "../domain/campfire.js";
import { state, emit } from "../state.js";

let curDay = null, unsub = null;
export const campDay = () => curDay;
// 오늘 상태 구독(날이 바뀌면 다시)
export function watchCampToday() {
  const d = kstDay(serverNow());
  if (d === curDay && unsub) return;
  if (unsub) unsub();
  curDay = d; state.camp = {};
  unsub = onValue(ref(db, fpath(state.fid, "campfires", String(d))), s => { state.camp = s.val() || {}; emit("camp"); }, () => {});
}

const base = () => fpath(state.fid, "campfires", String(curDay));

// 불 붙이기: 없을 때만 내 이름으로. 결과 {ok, mine}
export async function ignite() {
  const req = "g_" + rid(10);
  const r = ref(db, base() + "/ignition");
  try {
    const res = await runTransaction(r, cur => cur ? undefined : { by: state.mid, ses: state.ses, at: serverTimestamp(), req }, { applyLocally: false });
    if (res.committed) return { ok: true, mine: true };
    return { ok: true, mine: false };
  } catch {
    const v = (await get(r)).val();
    if (v && v.req === req) return { ok: true, mine: true };
    if (v) return { ok: true, mine: false };
    return { ok: false };
  }
}

// 노래 시작: 진행 중이 아니면 startAt = 지금 + 2초
export async function startSong(melodyId, lengthMs) {
  const r = ref(db, base() + "/song");
  const startAt = serverNow() + 2000;
  try {
    const res = await runTransaction(r, cur => {
      if (cur && cur.startAt + lengthMs + 1000 > serverNow()) return;
      return { id: "s_" + rid(8), melodyId, by: state.mid, ses: state.ses, issuedAt: serverTimestamp(), startAt };
    }, { applyLocally: false });
    return { ok: res.committed };
  } catch { return { ok: false }; }
}

export async function fireworks() {
  const r = ref(db, base() + "/fireworks");
  try {
    await runTransaction(r, cur => cur ? undefined : { id: "f_" + rid(8), by: state.mid, ses: state.ses, at: serverTimestamp() }, { applyLocally: false });
  } catch { /* 누가 먼저 */ }
}

// ---- 추억 기록 ----
const logBase = day => fpath(state.fid, "camplog", String(day));
export async function markAttendance() {
  const r = ref(db, logBase(curDay) + "/attendance/" + state.mid);
  // 성공(또는 이미 있음)이면 true, 실패면 false → 다시 시도
  try { const res = await runTransaction(r, cur => cur ? undefined : { firstAt: serverTimestamp(), ses: state.ses }, { applyLocally: false }); return res.committed || res.snapshot.exists(); }
  catch { return false; }
}
// 마시멜로 결과(개인 저장 성공 뒤): 없으면 쓰고, 있으면 같은지 확인
export async function logRoast(day, n, result) {
  const r = ref(db, logBase(day) + "/roasts/" + state.mid + "/" + n);
  try { await set(r, result); return true; }
  catch { const v = (await get(r).catch(() => null))?.val?.(); return v === result; }
}
// 개인 roast 기록 중 가족 기록에 안 들어간 것 다시 쓰기(재접속 때)
export async function recoverRoasts(player) {
  for (const [day, list] of Object.entries(player.roast || {})) {
    for (const [n, result] of Object.entries(list || {})) {
      const r = ref(db, logBase(day) + "/roasts/" + state.mid + "/" + n);
      const v = (await get(r).catch(() => null))?.val?.();
      if (v == null) await set(r, result);   // 실패하면 위로 알려 다음에 다시
    }
  }
}
// 기록 보기: 최근 30일
export async function readMemories() {
  const s = await get(ref(db, fpath(state.fid, "camplog")));
  const all = s.val() || {};
  const list = Object.entries(all).map(([day, v]) => ({ day: +day, ...v })).sort((a, b) => b.day - a.day).slice(0, 30);
  // 불꽃놀이는 실제로 터진 날만(campfires/{day}/fireworks) — 하루 누적 참석 수로 짐작하지 않는다
  await Promise.all(list.map(async d => {
    try { d.fireworks = (await get(ref(db, fpath(state.fid, "campfires", String(d.day), "fireworks")))).exists(); } catch { d.fireworks = false; }
    try { d.hunt = (await get(ref(db, fpath(state.fid, "campfires", String(d.day), "hunt")))).val(); } catch { d.hunt = null; }   // v10: 그날 마지막 보물찾기
  }));
  return list;
}
