// 시작: 내용표·지도 불러오기 → 로그인 → 가족 확인(만들기/신청/승인 대기) → 섬 입장
import { EMU, auth, onAuthStateChanged, signInAnonymously, signInGoogle, getRedirectResult, signOut } from "./services/fb.js";
import * as F from "./services/family.js";
import * as P from "./services/playerStore.js";
import * as W from "./services/worldStore.js";
import * as H from "./services/houseStore.js";
import { db, ref, get, set, onValue, fpath, serverNow } from "./services/fb.js";
import { recoverPlan } from "./domain/gather.js";
import { loadWorld } from "./game/world.js";
import { Game } from "./game/game.js";
import { UI, bindAdminExtras } from "./ui/ui.js";
import { state } from "./state.js";
import { FAMILY, APP_VERSION } from "./config/gameConfig.js";

const $ = id => document.getElementById(id);
const show = id => { document.querySelectorAll(".screen").forEach(s => s.hidden = s.id !== id); };
const params = new URLSearchParams(location.search);
const urlFid = params.get("f"), urlInvite = params.get("i");
if (urlFid) F.saveFid(urlFid);
let invite = urlInvite;

async function loadJSON(p) { const r = await fetch(p); if (!r.ok) throw new Error(p + " 못 불러옴"); return r.json(); }

let data, world, ui, entered = false;
async function boot() {
  try {
    [data, world] = await Promise.all([
      Promise.all(["items", "fish", "furniture", "recipes", "rooms", "appearance", "forage", "houseAppearance", "cooking", "insects", "campfire", "songs", "help", "lake", "gathering", "gathering.fields", "farm", "board"].map(n => loadJSON(`data/${n}.json`)))
        .then(([items, fish, furniture, recipes, rooms, appearance, forage, houseAppearance, cooking, insects, campfire, songs, help, lake, gathering, gatheringFields, farm, board]) => ({ items, fish, furniture, recipes, rooms, appearance, forage, houseAppearance, cooking, insects, campfire, songs, help, lake, gathering, gatheringFields, farm, board })),
      loadWorld(),
    ]);
  } catch (e) { $("loadMsg").textContent = "게임 파일을 못 불러왔어요. 인터넷 연결을 확인하고 다시 열어 주세요."; return; }
  ui = new UI(data); bindAdminExtras(ui);
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, user => { state.user = user; route().catch(err); });
}

function err(e) { console.error(e); $("errMsg").textContent = "문제가 생겼어요: " + (e && e.message || e); show("sError"); }

async function route() {
  if (entered) return;
  const fid = F.savedFid();
  if (!state.user) {
    if (fid && invite) { show("sLoading"); await signInAnonymously(auth); return; }
    show("sStart"); return;
  }
  if (!fid) {
    if (state.user.isAnonymous) { show("sNeedInvite"); return; }
    show("sCreate"); return;
  }
  state.fid = fid;
  show("sLoading");
  const mid = await F.myMid(fid);
  if (mid) return enter(mid);
  if (!state.user.isAnonymous && await F.amAdmin(fid)) return enter(FAMILY[1].mid);
  if (!invite) { show("sNeedInvite"); return; }
  show("sJoin");
}

async function enter(mid) {
  if (entered) return;   // 승인 알림이 두 번 와도 한 번만 입장(두 번 들어가면 스스로를 밀어냄)
  entered = true;
  state.mid = mid;
  state.isAdmin = await F.amAdmin(state.fid);
  try {   // 세션을 바꾸기 전에 버전부터: 옛 앱이 다른 기기를 밀어내거나 쓰지 않게(v7 ⑦ 지적)
    const m = (await get(ref(db, fpath(state.fid, "meta", "minApp")))).val();
    if (m && m > APP_VERSION) { state.oldApp = true; state.kicked = true; show("sGame"); $("pOldApp").hidden = false; return; }
  } catch { /* 못 읽으면 아래 실시간 검사가 막음 */ }
  await F.startSession(state.fid, mid);
  await checkMinApp();   // 옛 앱이면 복구·쓰기 전에 먼저 멈춤(v7 ⑤ 지적)
  await P.startPlayer();
  await P.ensurePlayer();
  // 줍던 중 꺼졌던 것 다시 받기
  try {
    const mine = await W.myRecentClaims();
    for (const c of mine) if (!state.player.applied[c.id] && c.qty > 0) await P.giveClaim(c);
  } catch { /* 다음에 다시 */ }
  // v4: 30분 채집 중 꺼졌던 것 — 내 복구 목록(gatherMine)만 읽음
  try {
    const mineG = await W.myGatherMine();
    const nowMs = Math.max(serverNow(), ...Object.values(mineG).filter(Number.isSafeInteger));
    const plan = recoverPlan(mineG, state.player.applied, nowMs);
    for (const id of plan.drop) await W.dropMine(id);
    for (const id of plan.grant) {
      const c = await W.readGather(id);
      if (!c) continue;                                   // 공유 기록이 아직 없으면 다음에 다시
      if (c.by !== state.mid) { await W.dropMine(id); continue; }
      const g = c.qty > 0 ? await P.giveClaim(c) : { ok: true };
      if (g.ok) await W.dropMine(id);
    }
  } catch { /* 다음에 다시 */ }
  await H.watchHousing();   // v3: 집 자리·겉모습(공유)
  history.replaceState(null, "", location.pathname);
  show("sGame");
  document.body.classList.add("playing");
  const game = new Game($("game"), world, data, ui);
  ui.attach(game);
  if (EMU) window.__dbg = { game, state, world, data };   // 개발 시험용
  const hasLook = state.members[mid] && state.members[mid].appearance;
  if (!hasLook) ui.openCloset(true);    // 버전 2에서 처음: 내 모습 고르기
  else setTimeout(() => ui.toast("왼쪽을 누르고 밀면 걸어요\n오른쪽 큰 버튼으로 줍기·낚시·문 열기", 4000), 800);
  if (state.isAdmin) {
    let last = 0; try { last = +localStorage.getItem("familyIsland.lastBackup") || 0; } catch { /* 무시 */ }
    if (Date.now() - last > 7 * 24 * 3600 * 1000) setTimeout(() => ui.toast("일주일이 지났어요. 가족 관리에서 백업을 받아 주세요", 3500), 2500);
  }
}

// 가족 섬이 더 새 버전을 요구하면 새로고침 안내(옛 앱으로 쓰지 않게)
// (게임 중에 바뀌어도) 조작을 멈추고 다시 열기 안내
async function checkMinApp() {
  onValue(ref(db, fpath(state.fid, "meta", "minApp")), s => {
    const m = s.val();
    // 관리자(아빠)가 새 버전으로 들어오면 가족 최소 버전을 올림 → 아직 옛 앱인 폰은 다시 열기 안내(서버도 옛 앱 쓰기를 막음)
    if (state.isAdmin && (m || 1) < APP_VERSION) set(ref(db, fpath(state.fid, "meta", "minApp")), APP_VERSION).catch(() => {});
    if (m && m > APP_VERSION && !state.oldApp) { state.oldApp = true; state.kicked = true; ui.closeAll(); $("pOldApp").hidden = false; }
  }, () => {});
}

// ---- 시작 화면 버튼 ----
$("goGoogle").onclick = () => signInGoogle().catch(e => ui.toast("구글 로그인 실패: " + e.code));
$("goGoogle2").onclick = () => signInGoogle().catch(e => ui.toast("구글 로그인 실패: " + e.code));
$("goGoogle3").onclick = () => signInGoogle().catch(e => ui.toast("구글 로그인 실패: " + e.code));
$("createBtn").onclick = async () => {
  $("createBtn").disabled = true;
  try { const { fid } = await F.createFamily($("islandName").value.trim()); state.fid = fid; await route(); }
  catch (e) { $("createBtn").disabled = false; err(e); }
};
// 자리 고르기(초대 받은 기기)
$("slots").innerHTML = FAMILY.map(f => `<button type="button" class="slot" data-n="${f.name}"><i style="background:${f.color}"></i>${f.name}</button>`).join("");
$("slots").querySelectorAll(".slot").forEach(b => b.onclick = async () => {
  try {
    await F.requestJoin(state.fid, invite, b.dataset.n);
    $("waitName").textContent = b.dataset.n;
    show("sWait");
    const un = F.watchMyRequest(state.fid, async r => {
      if (!r) return;
      if (r.status === "approved") { un(); const mid = await F.myMid(state.fid); if (mid) enter(mid); }
      if (r.status === "rejected") { un(); $("waitMsg").textContent = "아빠가 아직 허락하지 않았어요. 아빠에게 물어봐요."; }
    });
  } catch (e) { ui.toast(e.code === "PERMISSION_DENIED" ? "초대 주소가 바뀌었어요. 아빠에게 새 QR을 받아요" : "신청하지 못했어요"); }
});
$("waitCancel").onclick = async () => { await F.cancelRequest(state.fid).catch(() => {}); show("sJoin"); };
$("kickedReload").onclick = () => location.reload();
$("oldAppReload").onclick = () => location.reload();
$("errReload").onclick = () => location.reload();
$("logout").onclick = () => signOut(auth).then(() => location.reload());
$("ver").textContent = "v" + APP_VERSION;

// 세로 화면이면 돌려 달라는 안내(CSS가 처리), 서비스워커 등록
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
boot();
