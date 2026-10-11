// 화면 위 버튼·창(가방·도감·작업대·꾸미기·가족 관리)·알림
import { state, onState } from "../state.js";
import { FAMILY, familyOf, nameOf } from "../config/gameConfig.js";
import * as P from "../services/playerStore.js";
import * as F from "../services/family.js";
import { onConnection } from "../services/fb.js";

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
    setInterval(() => this.clock(), 10000); this.clock();
    onConnection(c => { $("net").hidden = c; });
    onState(w => {
      if (w === "members") this.who();
      if (w === "player") { if (!$("pBag").hidden) this.openBag(); if (!$("pDeco").hidden) this.decoRefresh(); if (!$("pCraft").hidden) this.openCraft(); }
      if (w === "kicked") { this.closeAll(); $("pKicked").hidden = false; }
    });
  }
  attach(game) { this.game = game; $("hud").hidden = false; $("act").hidden = false; $("bAdmin").hidden = !state.isAdmin; this.who(); }
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
    $("fishIcon").textContent = fish.icon; $("fishName").textContent = fish.name;
    $("fishInfo").textContent = `${fish.size}cm${first ? " · 도감에 새로 올렸어요!" : ""}`;
    $("pFish").hidden = false; clearTimeout(this._ft); this._ft = setTimeout(() => $("pFish").hidden = true, 2600);
  }
  inHouse(mine, owner, left) { $("bDeco").hidden = !mine || !!left; if (!left && !mine) this.toast(`${owner}네 집에 놀러 왔어요`); }

  // ---- 가방 ----
  openBag() {
    const inv = state.player ? state.player.inv : {};
    const keys = Object.keys(inv).filter(k => inv[k] > 0);
    const furn = state.player ? Object.values(state.player.furn).filter(f => f.state === "stored") : [];
    const fcount = {}; furn.forEach(f => fcount[f.type] = (fcount[f.type] || 0) + 1);
    $("bagGrid").innerHTML = keys.length || furn.length
      ? keys.map(k => { const it = this.data.items[k] || { icon: "❔", name: k }; return `<div class="cell"><b>${it.icon}</b>${esc(it.name)}<small>×${inv[k]}</small></div>`; }).join("")
        + Object.entries(fcount).map(([t, n]) => `<div class="cell furn"><b>${this.furnIcon(t)}</b>${esc(this.data.furniture[t].name)}<small>×${n}</small></div>`).join("")
      : `<p class="note">아직 비어 있어요. 나무를 흔들어 보세요.</p>`;
    $("pBag").hidden = false;
  }
  furnIcon(t) { return { chair_wood: "🪑", pot_flower: "🪴", table_wood: "🟫", bed_log: "🛏️", lamp_shell: "💡", bookshelf_wood: "📚" }[t] || "📦"; }

  // ---- 도감 ----
  openDex() {
    const dex = state.player ? state.player.dex : {};
    const n = this.data.fish.filter(f => dex[f.id]).length;
    $("dexSub").textContent = `${n} / ${this.data.fish.length}종 잡았어요`;
    $("dexGrid").innerHTML = this.data.fish.map(f => dex[f.id]
      ? `<div class="cell"><b>${f.icon}</b>${esc(f.name)}<small>최대 ${dex[f.id].biggest}cm</small></div>`
      : `<div class="cell dim"><b>❔</b>???<small>${{ sea: "바다", river: "강", pond: "연못" }[f.water]}</small></div>`).join("");
    $("pDex").hidden = false;
  }

  // ---- 작업대 ----
  openCraft() {
    const inv = state.player ? state.player.inv : {};
    $("craftList").innerHTML = Object.entries(this.data.recipes).map(([id, r]) => {
      const ok = Object.entries(r.items).every(([k, n]) => (inv[k] || 0) >= n);
      const need = Object.entries(r.items).map(([k, n]) => `${esc((this.data.items[k] || {}).name || k)} ${inv[k] || 0}/${n}`).join(" · ");
      return `<div class="recipe"><span class="ri">${this.furnIcon(r.type)}</span><div class="name">${esc(this.data.furniture[r.type].name)}<small>${need}</small></div><button class="btn${ok ? "" : " ghost"}" type="button" data-r="${id}" ${ok ? "" : "disabled"}>만들기</button></div>`;
    }).join("");
    $("craftList").querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
      b.disabled = true; this.busy(true);
      const r = await P.craftFurniture(b.dataset.r, this.data.recipes).catch(() => ({ ok: false }));
      this.busy(false);
      if (r.ok) this.toast(`${this.furnIcon(this.data.recipes[b.dataset.r].type)} ${this.data.furniture[this.data.recipes[b.dataset.r].type].name} 완성! 가방에 있어요`);
      else this.toast("만들지 못했어요 (" + (r.reason || "저장 실패") + ")");
      this.openCraft();
    });
    $("pCraft").hidden = false;
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
    $("decoGrid").innerHTML = stored.length ? stored.map(([id, f]) => `<button type="button" class="cell${g.deco.sel === id ? " sel" : ""}" data-f="${id}"><b>${this.furnIcon(f.type)}</b>${esc(this.data.furniture[f.type].name)}</button>`).join("")
      : `<p class="note">가방에 놓을 가구가 없어요. 거실 작업대(망치)에서 만들어요.</p>`;
    $("decoGrid").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { g.deco.picked = null; g.decoSelect(g.deco.sel === b.dataset.f ? null : b.dataset.f); this.decoRefresh(); });
    $("decoRot").onclick = async () => { const room = this.data.rooms[g.room]; this.busy(true); const r = await P.rotateFurniture(room, this.data.furniture, g.deco.picked).catch(() => ({ ok: false })); this.busy(false); if (!r.ok) this.toast("돌릴 수 없어요 (" + (r.reason || "") + ")"); this.decoRefresh(); };
    $("decoStore").onclick = async () => { this.busy(true); const r = await P.storeFurniture(g.deco.picked).catch(() => ({ ok: false })); this.busy(false); if (r.ok) g.deco.picked = null; else this.toast("넣지 못했어요"); this.decoRefresh(); };
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
