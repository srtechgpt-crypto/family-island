// 시작: 내용표·지도 불러오기 → 로그인 → 가족 확인(만들기/신청/승인 대기) → 섬 입장
import { EMU, auth, onAuthStateChanged, signInAnonymously, signInGoogle, getRedirectResult, signOut } from "./services/fb.js";
import * as F from "./services/family.js";
import * as P from "./services/playerStore.js";
import * as W from "./services/worldStore.js";
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
      Promise.all(["items", "fish", "furniture", "recipes", "rooms"].map(n => loadJSON(`data/${n}.json`)))
        .then(([items, fish, furniture, recipes, rooms]) => ({ items, fish, furniture, recipes, rooms })),
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
  await F.startSession(state.fid, mid);
  await P.startPlayer();
  await P.ensurePlayer();
  // 줍던 중 꺼졌던 것 다시 받기
  try {
    const mine = await W.myRecentClaims();
    for (const c of mine) if (!state.player.applied[c.id] && c.qty > 0) await P.giveClaim(c);
  } catch { /* 다음에 다시 */ }
  history.replaceState(null, "", location.pathname);
  show("sGame");
  document.body.classList.add("playing");
  const game = new Game($("game"), world, data, ui);
  ui.attach(game);
  if (EMU) window.__dbg = { game, state, world, data };   // 개발 시험용
  if (state.isAdmin) {
    let last = 0; try { last = +localStorage.getItem("familyIsland.lastBackup") || 0; } catch { /* 무시 */ }
    if (Date.now() - last > 7 * 24 * 3600 * 1000) setTimeout(() => ui.toast("일주일이 지났어요. 가족 관리에서 백업을 받아 주세요", 3500), 2500);
  }
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
$("errReload").onclick = () => location.reload();
$("logout").onclick = () => signOut(auth).then(() => location.reload());
$("ver").textContent = "v" + APP_VERSION;

// 세로 화면이면 돌려 달라는 안내(CSS가 처리), 서비스워커 등록
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
boot();
