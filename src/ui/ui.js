// 화면 위 버튼·창(가방·도감·작업대·꾸미기·가족 관리)·알림
import { state, onState } from "../state.js";
import { iconHtml } from "../game/sprites.js";
import { FAMILY, familyOf, nameOf } from "../config/gameConfig.js";
import * as P from "../services/playerStore.js";
import * as F from "../services/family.js";
import { onConnection } from "../services/fb.js";
import { sendEmote } from "../services/emoteStore.js";
import { EMOTE_GROUPS, FACE_KINDS } from "../domain/emotes.js";
// 감정 표현 이름표: kind → [그림, 이름]
const EMO_LABEL = { heart: ["💗", "하트"], laugh: ["😆", "웃음"], surprise: ["😲", "깜짝"], sad: ["😢", "슬픔"], angry: ["😠", "뿔남"], sleepy: ["💤", "졸려"], curious: ["❓", "궁금"], idea: ["💡", "생각났다"], thanks: ["🙏", "고마워"],
  wave: ["👋", "손 흔들기"], clap: ["👏", "박수"], bow: ["🙇", "꾸벅 인사"], jump: ["🦘", "점프"], spin: ["🌀", "빙글 돌기"], sit: ["🪑", "앉기"], thumbs_up: ["👍", "엄지척"], peace: ["✌️", "브이"],
  dance: ["💃", "신나는 춤"], robot: ["🤖", "로봇 춤"], ballet: ["🩰", "발레"], bunny: ["🐰", "토끼 깡충"], freestyle: ["🕺", "막춤"] };
import { drawCharacter } from "../game/character.js";
import { appearanceOf, validateAppearance } from "../domain/appearance.js";
import { installV3 } from "./ui3.js";
import { installV5 } from "./ui5.js";
import { installV8 } from "./ui8.js";
import { installV10 } from "./ui10.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class UI {
  constructor(data) {
    this.data = data; this.game = null;
    document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { b.closest(".panel").hidden = true; });
    $("bBag").onclick = () => this.openBag();
    $("bDex").onclick = () => this.openDex();
    $("bDeco").onclick = () => this.openDeco();
    $("bAdmin").onclick = () => this.openAdmin();
    $("act").addEventListener("pointerdown", e => { e.preventDefault(); this.game && this.game.act(); });
    $("decoDone").onclick = () => this.decoClose();
    $("bCloset").onclick = () => this.openCloset(false);
    $("closetCancel").onclick = () => { if (!this._closetFirst) $("pCloset").hidden = true; else this.saveCloset(); };
    $("closetSave").onclick = () => this.saveCloset();
    // 감정 표현: 👋·💗는 바로, 😊는 표정/동작/춤 고르기 창
    document.querySelectorAll("#emotes .emo[data-e]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); this.emote(b.dataset.e); }));
    $("emoMore").addEventListener("pointerdown", e => { e.preventDefault(); if ($("pEmo").hidden) { this.closeAll(); this.emoTab(this._emoTab || "face"); $("pEmo").hidden = false; } else $("pEmo").hidden = true; });
    $("emoClose").onclick = () => { $("pEmo").hidden = true; };
    $("emoTabs").querySelectorAll("button").forEach(b => b.onclick = () => this.emoTab(b.dataset.g));
    $("emoGrid").addEventListener("click", e => { const b = e.target.closest("button[data-e]"); if (!b) return; $("pEmo").hidden = true; this.emote(b.dataset.e); });
    this.bindV3(); this.bindV5(); this.bindV8(); this.bindV10();
    setInterval(() => this.clock(), 10000); this.clock();
    onConnection(c => { $("net").hidden = c; });
    onState(w => {
      if (w === "members") this.who();
      if (w === "player") { if (!$("pBag").hidden) this.openBag(); if (!$("pDeco").hidden) this.decoRefresh(); if (!$("pCraft").hidden) this.openCraft(); }
      if (w === "kicked") { this.closeAll(); $("pKicked").hidden = false; }
    });
  }
  attach(game) { this.game = game; $("hud").hidden = false; $("act").hidden = false; $("emotes").hidden = false; $("bAdmin").hidden = !state.isAdmin; this.who(); }
  emoTab(gid) {
    this._emoTab = gid;
    $("emoTabs").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.g === gid ? "true" : "false"));
    $("emoGrid").innerHTML = EMOTE_GROUPS[gid].map(k => `<button type="button" data-e="${k}"><b>${EMO_LABEL[k][0]}</b>${EMO_LABEL[k][1]}</button>`).join("");
  }
  async emote(kind) {
    const g = this.game; if (!g) return;
    if (g.lakeL && g.lakeL.boating && !FACE_KINDS.includes(kind)) { this.toast("배 위에서는 표정만 돼요. 내려서 해 봐요"); return; }
    const r = await sendEmote(kind);
    if (r.ok) return;
    if (r.reason === "연결 없음") this.toast("인터넷 연결을 기다리는 중이에요");
    else if (r.reason === "busy" || r.reason === "잠깐만") this.toast("잠깐만요, 하나씩 해요");
  }
  modalOpen() { return [...document.querySelectorAll(".panel")].some(p => !p.hidden && p.id !== "pDeco"); }
  closeAll() { document.querySelectorAll(".panel").forEach(p => p.hidden = true); }

  clock() { const d = new Date(), h = d.getHours(), m = d.getMinutes(); $("clock").textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? "오전" : "오후"} ${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`; }
  who() {
    const online = Object.entries(state.members).filter(([, m]) => m.uid && m.seen).map(([mid]) => mid);
    $("who").innerHTML = FAMILY.filter(f => online.includes(f.mid)).map(f => `<span class="face" style="background:${f.color}" title="${esc(nameOf(f.mid))}">${esc(nameOf(f.mid)[0])}</span>`).join("");
  }
  setAction(label) { const b = $("act"); if (b.dataset.l !== (label || "")) { b.dataset.l = label || ""; b.textContent = label || "행동"; b.classList.toggle("off", !label); } }
  toast(s, ms = 1600) { if (!s) return; const t = $("toast"); t.textContent = s; t.hidden = false; clearTimeout(this._tt); this._tt = setTimeout(() => t.hidden = true, ms); }
  busy(on) { $("busy").hidden = !on; }
  bite() { try { navigator.vibrate && navigator.vibrate([120]); } catch { /* 진동 없음 */ } }
  fishCaught(fish, first) {
    $("fishIcon").innerHTML = iconHtml(fish.id, fish.icon); $("fishName").textContent = fish.name;
    $("fishInfo").textContent = `${fish.size}cm${first ? " · 도감에 새로 올렸어요!" : ""}`;
    $("pFish").hidden = false; clearTimeout(this._ft); this._ft = setTimeout(() => $("pFish").hidden = true, 2600);
  }
  inHouse(mine, owner, left) { $("bDeco").hidden = !mine || !!left; if (!left && !mine) this.toast(`${owner}네 집에 놀러 왔어요`); }

  // ---- 큰 지도 ----
  openMap() {
    $("pMap").hidden = false;
    const draw = () => { if ($("pMap").hidden || !this.game) return; this.game.drawBigMap($("bigMap")); setTimeout(draw, 500); };
    requestAnimationFrame(draw);
  }

  // ---- 옷장(처음 들어올 때 + 언제든) ----
  openCloset(first) {
    this._closetFirst = !!first;
    const cur = state.members[state.mid] && state.members[state.mid].appearance;
    this._look = { ...appearanceOf(cur, state.mid) };
    $("closetTitle").textContent = first ? "내 모습 고르기" : "옷장";
    $("closetSub").textContent = first ? "새 모습으로 바뀌었어요! 머리와 옷을 골라 보세요. 나중에 옷장에서 언제든 바꿀 수 있어요." : "머리와 옷을 골라요. 다른 가족 폰에도 똑같이 보여요.";
    $("closetCancel").textContent = first ? "이대로 할래요" : "그만두기";
    this.renderCloset(); $("pCloset").hidden = false;
    const tick = () => { if ($("pCloset").hidden) return; this.drawClosetPrev(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  renderCloset() {
    const L = this._look, pal = this.data.appearance;
    const chips = (id, items, key) => { $(id).innerHTML = items.map(([v, t]) => `<button type="button" aria-pressed="${L[key] === v}" data-v="${v}">${esc(t)}</button>`).join("");
      $(id).querySelectorAll("button").forEach(b => b.onclick = () => { L[key] = b.dataset.v; this.renderCloset(); }); };
    const sw = (id, cols, key) => { $(id).innerHTML = cols.map((c, i) => `<button type="button" aria-label="색 ${i + 1}" aria-pressed="${L[key] === i}" style="background:${c}" data-i="${i}"></button>`).join("");
      $(id).querySelectorAll("button").forEach(b => b.onclick = () => { L[key] = +b.dataset.i; this.renderCloset(); }); };
    chips("cHair", pal.hairStyles.map(h => [h.id, h.name]), "hairStyle");
    sw("cHairC", pal.hairColors, "hairColor");
    sw("cTop", pal.clothColors, "topColor");
    chips("cKind", [["pants", "바지"], ["skirt", "치마"]], "bottomType");
    sw("cBot", pal.clothColors, "bottomColor");
  }
  drawClosetPrev() {
    const c = $("closetPrev"), g = c.getContext("2d"), t = performance.now() / 1000;
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 150, 190);
    g.fillStyle = "#7ab857"; for (let i = 0; i < 12; i++) g.fillRect((i * 37) % 150, (i * 53) % 190, 2, 5);
    drawCharacter(g, this._look, this.data.appearance, 75, 170, 140, 0, t, false, null);
  }
  async saveCloset() {
    const v = validateAppearance({ v: 1, ...this._look });
    if (!v.ok) { this.toast("고른 모습을 저장할 수 없어요"); return; }
    this.busy(true);
    try { await F.saveAppearance(state.fid, state.mid, v.appearance); $("pCloset").hidden = true; this.toast("새 모습을 저장했어요!"); }
    catch (e) { this.toast("저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요"); }
    this.busy(false);
  }

  // ---- 가방 ----
  openBag() {
    const inv = state.player ? state.player.inv : {};
    const keys = Object.keys(inv).filter(k => inv[k] > 0);
    const furn = state.player ? Object.values(state.player.furn).filter(f => f.state === "stored") : [];
    const fcount = {}; furn.forEach(f => fcount[f.type] = (fcount[f.type] || 0) + 1);
    $("bagGrid").innerHTML = keys.length || furn.length
      ? keys.map(k => { const it = this.data.items[k] || { icon: "❔", name: k }; return `<div class="cell"><b>${iconHtml(k, it.icon)}</b>${esc(it.name)}<small>×${inv[k]}</small>${this.bagAction(k)}</div>`; }).join("")
        + Object.entries(fcount).map(([t, n]) => `<div class="cell furn"><b>${this.furnIcon(t)}</b>${esc((this.data.furniture[t] || { name: t }).name)}<small>×${n}</small></div>`).join("")
      : `<p class="note">아직 비어 있어요. 나무를 흔들어 보세요.</p>`;
    this.bindBagActions();
    $("pBag").hidden = false;
  }
  furnIcon(t) { return { chair_wood: "🪑", pot_flower: "🪴", table_wood: "🟫", bed_log: "🛏️", lamp_shell: "💡", bookshelf_wood: "📚", stove_wood: "🍳", wardrobe_wood: "🚪", sofa_wood: "🛋️", dining_table: "🍽️", fireplace_stone: "🔥", cabinet_low: "🗄️", rocking_chair: "🪑", fish_tank: "🐠", tree_pot: "🌳", piano_wood: "🎹", desk_wood: "📝", mirror_stand: "🪞", vanity: "💄", bunk_bed: "🛏️", clock_tall: "🕰️", dresser: "🗄️" }[t] || "📦"; }

  // ---- 도감 ----
  openDex() {
    const tab = this._dexTab || "fish";
    document.querySelectorAll("#dexTabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === tab));
    if (tab !== "fish") { tab === "bug" ? this.dexBugs() : this.dexFood(); $("pDex").hidden = false; return; }
    const dex = state.player ? state.player.dex : {};
    const n = this.data.fish.filter(f => dex[f.id]).length;
    $("dexSub").textContent = `${n} / ${this.data.fish.length}종 잡았어요`;
    $("dexGrid").innerHTML = this.data.fish.map(f => dex[f.id]
      ? `<div class="cell"><b>${iconHtml(f.id, f.icon)}</b>${esc(f.name)}<small>최대 ${dex[f.id].biggest}cm</small></div>`
      : `<div class="cell dim"><b>❔</b>???<small>${{ sea: "바다", river: "강", pond: "연못", lake: "호수(배 위)" }[f.water]}</small></div>`).join("");
    $("pDex").hidden = false;
  }

  // ---- 작업대 ----
  openCraft() {
    const inv = state.player ? state.player.inv : {};
    $("craftList").innerHTML = Object.entries(this.data.recipes).map(([id, r]) => {
      const ok = Object.entries(r.items).every(([k, n]) => (inv[k] || 0) >= n);
      const need = Object.entries(r.items).map(([k, n]) => `${esc((this.data.items[k] || {}).name || k)} ${inv[k] || 0}/${n}`).join(" · ");
      const o = this.craftOut(r);
      return `<div class="recipe"><span class="ri">${o.img}</span><div class="name">${esc(o.name)}<small>${need}</small></div><button class="btn${ok ? "" : " ghost"}" type="button" data-r="${id}" ${ok ? "" : "disabled"}>만들기</button></div>`;
    }).join("");
    $("craftList").querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
      b.disabled = true; this.busy(true);
      const r = await P.craftFurniture(b.dataset.r, this.data.recipes).catch(() => ({ ok: false }));
      this.busy(false);
      if (r.ok) { const o = this.craftOut(this.data.recipes[b.dataset.r]); this.toast(`${o.icon} ${o.name} 완성! 가방에 있어요`); }
      else this.toast("만들지 못했어요 (" + (r.reason || "저장 실패") + ")");
      this.openCraft();
    });
    $("pCraft").hidden = false;
  }

  // 작업대 결과물 이름·그림(가구 또는 아이템)
  craftOut(r) {
    if (r.outputKind === "item") { const k = Object.keys(r.out || {})[0], it = this.data.items[k] || { icon: "📦", name: k }; return { icon: it.icon, img: iconHtml(k, it.icon), name: it.name }; }
    const icon = this.furnIcon(r.type);
    return { icon, img: icon, name: (this.data.furniture[r.type] || { name: r.type }).name };
  }

  // ---- 꾸미기 ----
  openDeco() { if (this.game.startDeco()) { this.decoRefresh(); $("pDeco").hidden = false; $("bDeco").hidden = true; } }
  decoClose() { if (this.game) this.game.stopDeco(); $("pDeco").hidden = true; if (this.game && this.game.mode === "house" && this.game.houseMid === state.mid) $("bDeco").hidden = false; }
  decoRefresh() {
    const g = this.game; if (!g || !g.deco) return;
    const furn = Object.entries(state.player.furn);
    const stored = furn.filter(([, f]) => f.state === "stored");
    const picked = g.deco.picked && state.player.furn[g.deco.picked];
    $("decoHint").textContent = g.deco.sel ? "놓을 자리를 방바닥에서 눌러요" : picked ? "고른 가구를 어떻게 할까요?" : "놓을 가구를 고르거나, 방에 있는 가구를 눌러요";
    $("decoPick").hidden = !picked;
    $("decoGrid").innerHTML = stored.length ? stored.map(([id, f]) => `<button type="button" class="cell${g.deco.sel === id ? " sel" : ""}" data-f="${id}"><b>${this.furnIcon(f.type)}</b>${esc((this.data.furniture[f.type] || { name: f.type }).name)}</button>`).join("")
      : `<p class="note">가방에 놓을 가구가 없어요. 거실 작업대(망치)에서 만들어요.</p>`;
    $("decoGrid").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { g.deco.picked = null; g.decoSelect(g.deco.sel === b.dataset.f ? null : b.dataset.f); this.decoRefresh(); });
    $("decoRot").onclick = async () => { const room = this.data.rooms[g.room], pf = state.player.furn[g.deco.picked]; if (pf && g.coversMe(pf.type, pf.x, pf.y, ((pf.rot || 0) + 1) % 4)) { this.toast("캐릭터가 서 있는 자리예요"); return; } this.busy(true); const r = await P.rotateFurniture(room, this.data.furniture, g.deco.picked).catch(() => ({ ok: false })); this.busy(false); if (!r.ok) this.toast("돌릴 수 없어요 (" + (r.reason || "") + ")"); this.decoRefresh(); };
    $("decoStore").onclick = async () => { const deco = g.deco, id = deco.picked; this.busy(true); const r = await P.storeFurniture(id).catch(() => ({ ok: false })); this.busy(false); if (!r.ok) this.toast("넣지 못했어요"); else if (g.deco === deco && deco.picked === id) deco.picked = null; this.decoRefresh(); };   // 저장 중 꾸미기를 닫거나 다른 가구를 골랐으면 그대로 둠
    $("decoMove").onclick = () => { g.deco.sel = g.deco.picked; g.deco.picked = null; this.decoRefresh(); };
  }
  decoPicked(id) { this.game.deco.picked = id; this.game.deco.sel = null; this.decoRefresh(); }

  // ---- 가족 관리(관리자) ----
  async openAdmin() {
    $("pAdmin").hidden = false;
    const inv = await F.getInvite(state.fid);
    const link = F.inviteLink(state.fid, inv);
    $("inviteLink").value = link;
    this.drawQR(link);
    if (!this._reqUnsub) this._reqUnsub = F.watchRequests(state.fid, reqs => this.renderReqs(reqs));
    this.renderNames();
  }
  // 가족 이름 바꾸기(공개 코드엔 호칭만 있고, 실제 이름은 여기서 넣는다)
  renderNames() {
    $("nameList").innerHTML = FAMILY.map(f => `<div class="req"><div class="name">${esc(f.name)} 자리</div><input type="text" id="nm_${f.mid}" maxlength="6" value="${esc(nameOf(f.mid))}"><button class="btn ghost" type="button" data-nm="${f.mid}">저장</button></div>`).join("");
    $("nameList").querySelectorAll("[data-nm]").forEach(b => b.onclick = async () => {
      const mid = b.dataset.nm, v = $("nm_" + mid).value.trim();
      if (!v || v.length > 6) { this.toast("이름은 1~6글자로 써 주세요"); return; }
      try { await F.renameMember(state.fid, mid, v); this.toast(`${v}(으)로 바꿨어요`); } catch (e) { this.toast("바꾸지 못했어요: " + e.message); }
    });
  }
  drawQR(text) {
    try { const qr = window.qrcode(0, "M"); qr.addData(text); qr.make(); $("qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
    catch { $("qr").textContent = "QR을 만들지 못했어요. 아래 주소를 보내 주세요."; }
  }
  renderReqs(reqs) {
    const pend = Object.entries(reqs).filter(([, r]) => r && r.status === "pending");
    $("reqList").innerHTML = pend.length ? pend.map(([uid, r]) => {
      const guess = FAMILY.find(f => f.name === r.name);
      return `<div class="req"><div class="name">${esc(r.name)} <small>님이 들어오고 싶어해요</small></div>
        <select id="sel_${uid}">${FAMILY.map(f => `<option value="${f.mid}" ${guess && guess.mid === f.mid ? "selected" : ""}>${esc(nameOf(f.mid))}(${esc(f.name)}) 자리${state.members[f.mid] && state.members[f.mid].uid ? " (다시 연결)" : ""}</option>`).join("")}</select>
        <button class="btn" type="button" data-ok="${uid}">들어오게 하기</button><button class="btn ghost" type="button" data-no="${uid}">거절</button></div>`;
    }).join("") : `<p class="note">기다리는 신청이 없어요.</p>`;
    $("reqList").querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
      const uid = b.dataset.ok, mid = $("sel_" + uid).value;
      b.disabled = true;
      try { await F.linkMember(state.fid, uid, mid, uid); this.toast(`${nameOf(mid)} 자리로 들어오게 했어요`); }
      catch (e) { this.toast("승인하지 못했어요: " + e.message); b.disabled = false; }
    });
    $("reqList").querySelectorAll("[data-no]").forEach(b => b.onclick = () => F.rejectRequest(state.fid, b.dataset.no));
  }
}

installV3(UI);
installV5(UI);
installV8(UI);
installV10(UI);

// 관리자 화면의 나머지 버튼(복사·초대 바꾸기·백업·복원)
export function bindAdminExtras(ui) {
  $("copyLink").onclick = async () => { try { await navigator.clipboard.writeText($("inviteLink").value); ui.toast("초대 주소를 복사했어요"); } catch { $("inviteLink").select(); } };
  $("newInvite").onclick = async () => { const t = await F.newInvite(state.fid); const l = F.inviteLink(state.fid, t); $("inviteLink").value = l; ui.drawQR(l); ui.toast("새 초대 주소를 만들었어요. 옛 주소로는 신청할 수 없어요"); };
  $("backup").onclick = async () => {
    ui.busy(true);
    try {
      const data = await F.backupFamily(state.fid);
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      const d = new Date(); a.download = `가족섬_백업_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      try { localStorage.setItem("familyIsland.lastBackup", String(Date.now())); } catch { /* 무시 */ }
      ui.toast("백업 파일을 받았어요");
    } catch (e) { ui.toast("백업하지 못했어요: " + e.message); }
    ui.busy(false);
  };
  $("restoreFile").onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { try { ui._restore = JSON.parse(rd.result); $("restoreAsk").hidden = false; $("restoreWhen").textContent = new Date(ui._restore.at).toLocaleString("ko-KR"); } catch { ui.toast("백업 파일을 읽지 못했어요"); } };
    rd.readAsText(file);
  };
  $("restoreYes").onclick = async () => {
    ui.busy(true);
    try { await F.restorePlayers(state.fid, ui._restore); ui.toast("가방·집·도감을 백업 때로 되돌렸어요"); $("restoreAsk").hidden = true; }
    catch (e) { ui.toast("복원하지 못했어요: " + e.message); }
    ui.busy(false);
  };
  $("restoreNo").onclick = () => { $("restoreAsk").hidden = true; $("restoreFile").value = ""; };
}
