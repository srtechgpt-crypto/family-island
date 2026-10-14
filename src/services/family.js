// 가족 만들기·입장 신청·승인·세션 (규칙은 docs/데이터구조.md)
import { db, ref, get, set, update, remove, onValue, runTransaction, serverTimestamp, fpath, rid } from "./fb.js";
import { FAMILY, ADMIN_MID, APP_VERSION } from "../config/gameConfig.js";
import { state, emit } from "../state.js";
import { restoreMerge } from "../domain/restore.js";

const LS_FID = "familyIsland.fid";
export const savedFid = () => { try { return localStorage.getItem(LS_FID); } catch { return null; } };
export const saveFid = fid => { try { localStorage.setItem(LS_FID, fid); } catch { /* 저장 못 해도 진행 */ } };

export function inviteLink(fid, token) {
  const base = location.origin + location.pathname.replace(/index\.html$/, "");
  return `${base}?f=${encodeURIComponent(fid)}&i=${encodeURIComponent(token)}`;
}

// 관리자(구글 로그인)가 가족을 처음 만든다. 관리자는 아빠 자리에 바로 연결된다.
export async function createFamily(islandName) {
  const uid = state.user.uid;
  const fid = rid(22);
  const invite = rid(28);
  await set(ref(db, fpath(fid)), {
    meta: { name: islandName || "우리 가족 섬", createdAt: serverTimestamp(), schema: 1, minApp: 1 },
    admins: { [uid]: true },
    secret: { invite },
  });
  await linkMember(fid, uid, ADMIN_MID, null);
  saveFid(fid);
  return { fid, invite };
}

// 관리자가 기기(uid)를 자리(mid)에 연결. 옛 기기 연결은 끊는다.
export async function linkMember(fid, uid, mid, reqUid) {
  const fam = FAMILY.find(f => f.mid === mid);
  const cur = (await get(ref(db, fpath(fid, "members", mid)))).val();
  const changes = {};
  if (cur && cur.uid && cur.uid !== uid) changes[`uidMap/${cur.uid}`] = null;
  changes[`uidMap/${uid}`] = mid;
  changes[`members/${mid}/uid`] = uid;
  if (!cur || !cur.name) { changes[`members/${mid}/name`] = fam.name; changes[`members/${mid}/color`] = fam.color; }
  if (reqUid) { changes[`joinReq/${reqUid}/status`] = "approved"; changes[`joinReq/${reqUid}/mid`] = mid; }
  await update(ref(db, fpath(fid)), changes);
}

// 내 모습 저장(현재 세션만 규칙이 받아줌)
export async function saveAppearance(fid, mid, look) {
  await set(ref(db, fpath(fid, "members", mid, "appearance")), { ...look, ses: state.ses });
}

export async function renameMember(fid, mid, name) {
  await set(ref(db, fpath(fid, "members", mid, "name")), name);
}

export async function rejectRequest(fid, reqUid) {
  await update(ref(db, fpath(fid, "joinReq", reqUid)), { status: "rejected" });
}

export async function newInvite(fid) {
  const invite = rid(28);
  await set(ref(db, fpath(fid, "secret", "invite")), invite);
  return invite;
}
export async function getInvite(fid) { return (await get(ref(db, fpath(fid, "secret", "invite")))).val(); }

// 초대 받은 기기: 입장 신청
export async function requestJoin(fid, token, name) {
  await set(ref(db, fpath(fid, "joinReq", state.user.uid)), { name, token, at: serverTimestamp(), status: "pending" });
}
export function watchMyRequest(fid, cb) {
  return onValue(ref(db, fpath(fid, "joinReq", state.user.uid)), s => cb(s.val()), () => cb(null));
}
export async function cancelRequest(fid) { await remove(ref(db, fpath(fid, "joinReq", state.user.uid))); }

// 내 자리 찾기(승인됐는지)
export async function myMid(fid) {
  try { return (await get(ref(db, fpath(fid, "uidMap", state.user.uid)))).val(); }
  catch { return null; }
}
export async function amAdmin(fid) {
  try { return (await get(ref(db, fpath(fid, "admins", state.user.uid)))).val() === true; }
  catch { return false; }
}
export function watchRequests(fid, cb) {
  return onValue(ref(db, fpath(fid, "joinReq")), s => cb(s.val() || {}), () => cb({}));
}

// 세션 시작: 이 기기가 지금 이 자리의 주인. 다른 기기가 들어오면 kicked.
export async function startSession(fid, mid) {
  const ses = rid(16);
  await update(ref(db, fpath(fid, "members", mid)), { ses, seen: serverTimestamp(), app: APP_VERSION });   // app: 집 옮기기는 가족 모두 새 버전일 때만
  state.ses = ses;
  onValue(ref(db, fpath(fid, "members", mid, "ses")), s => {
    if (s.val() && s.val() !== state.ses && !state.kicked) { state.kicked = true; emit("kicked"); }
  });
  await new Promise(resolve => {
    let first = true;
    onValue(ref(db, fpath(fid, "members")), s => { state.members = s.val() || {}; emit("members"); if (first) { first = false; resolve(); } }, () => resolve());
  });
  return ses;
}

// 백업: 가족 데이터(비밀 제외) 한 파일
export async function backupFamily(fid) {
  const parts = ["meta", "members", "uidMap", "players", "claims", "drops", "housing", "camplog", "bday"];   // v10: 생일 카드도
  const out = { app: "family-island", version: 1, at: Date.now(), fid };
  for (const p of parts) out[p] = (await get(ref(db, fpath(fid, p)))).val();
  return out;
}
// 복원(1-A): 각자의 가방·집·도감(players)만 되돌린다
export async function restorePlayers(fid, backup) {
  if (!backup || backup.app !== "family-island" || !backup.players) throw new Error("가족 섬 백업 파일이 아니에요");
  const members = (await get(ref(db, fpath(fid, "members")))).val() || {};
  const failed = [];
  // 사람마다 트랜잭션: 저장 직전의 최신 값 위에 백업을 합친다(그사이 가족이 저장한 것도 반영)
  for (const [mid, p] of Object.entries(backup.players)) {
    try {
      await runTransaction(ref(db, fpath(fid, "players", mid)), cur => restoreMerge(cur, p, members[mid] && members[mid].ses), { applyLocally: false });
    } catch { failed.push(mid); }
  }
  if (failed.length) throw new Error(failed.map(m => FAMILY.find(f => f.mid === m)?.name || m).join(", ") + " 복원 실패");
}
