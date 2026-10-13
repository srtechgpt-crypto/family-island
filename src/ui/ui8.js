// v8 화면: 옷장 '옷 만들기'·'내가 만든 옷', 오늘의 부탁 게시판
import { state } from "../state.js";
import { iconHtml } from "../game/sprites.js";
import * as P from "../services/playerStore.js";
import * as RQ from "../services/requestStore.js";
import { isConnected } from "../services/fb.js";
import { drawCharacter } from "../game/character.js";
import { outfitId, sewCost, sewHint, parseOutfit } from "../domain/outfits.js";
import { askable, freeSlot } from "../domain/requests.js";
import { nameOf } from "../config/gameConfig.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function installV8(UI) {
  const proto = UI.prototype;

  // ---- 옷장 탭 ----
  const baseOpen = proto.openCloset;
  proto.openCloset = function (first) {
    this._closetTab = "look";
    if (!this._sew) this._sew = { pattern: "dot", dye: "pink" };
    $("closetTabs").hidden = !!first;          // 처음 모습 고르기 때는 탭 없이
    baseOpen.call(this, first);
    this.closetTab("look");
  };
  proto.closetTab = function (t) {
    this._closetTab = t;
    $("closetTabs").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === t ? "true" : "false"));
    $("lookBox").hidden = t !== "look"; $("sewBox").hidden = t !== "sew";
    $("closetSave").hidden = t !== "look";
    if (t === "sew") this.renderSew(); else this.renderOutfits();
  };
  // 모습 고르기 안 '내가 만든 옷' 줄(가진 옷만, 없으면 안내)
  proto.renderOutfits = function () {
    const inv = (state.player && state.player.inv) || {}, items = this.data.items, L = this._look;
    const mine = Object.keys(inv).filter(k => parseOutfit(k) && inv[k] > 0).sort();
    if (L.outfit && !mine.includes(L.outfit)) delete L.outfit;
    $("cOut").innerHTML = mine.length
      ? [`<button type="button" data-o="" aria-pressed="${!L.outfit}">윗옷 색 그대로</button>`, ...mine.map(k => `<button type="button" data-o="${k}" aria-pressed="${L.outfit === k}">${esc(items[k].name)}</button>`)].join("")
      : `<span class="note">아직 없어요. 위 '✂️ 옷 만들기'에서 만들어요!</span>`;
    $("cOut").querySelectorAll("button[data-o]").forEach(b => b.onclick = () => { if (b.dataset.o) L.outfit = b.dataset.o; else delete L.outfit; this.renderOutfits(); });
  };
  proto.renderSew = function () {
    const S = this._sew, farm = this.data.farm, items = this.data.items, inv = (state.player && state.player.inv) || {};
    $("sPat").innerHTML = farm.patterns.map(p => `<button type="button" data-p="${p.id}" aria-pressed="${S.pattern === p.id}">${{ plain: "▢", stripe: "☰", dot: "⁘" }[p.id]} ${esc(p.name)}</button>`).join("");
    $("sDye").innerHTML = farm.dyes.map(d => `<button type="button" aria-label="${esc(d.name)}" title="${esc(d.name)}" aria-pressed="${S.dye === d.id}" style="background:${d.color}" data-d="${d.id}"></button>`).join("");
    $("sPat").querySelectorAll("button").forEach(b => b.onclick = () => { S.pattern = b.dataset.p; this.renderSew(); });
    $("sDye").querySelectorAll("button").forEach(b => b.onclick = () => { S.dye = b.dataset.d; this.renderSew(); });
    const cost = sewCost(S.dye);
    $("sNeed").innerHTML = Object.entries(cost).map(([k, n]) => { const have = inv[k] || 0; return `<span class="${have < n ? "lack" : ""}">${items[k].icon} ${esc(items[k].name)} ${have}/${n}</span>`; }).join("");
    const hint = sewHint(inv, S.dye), out = items[outfitId(S.pattern, S.dye)], has = inv[outfitId(S.pattern, S.dye)] || 0;
    $("sHint").textContent = hint || `${out.name}를 만들 수 있어요!${has ? ` (지금 ${has}벌 있어요)` : ""}`;
    $("sewGo").disabled = !!hint;
    $("sewGo").className = "btn" + (hint ? " ghost" : "");
  };
  proto.doSew = async function () {
    const { pattern, dye } = this._sew;          // 기다리는 동안 고른 값이 바뀌어도 실제로 만든 옷으로(⑦ 지적)
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    $("sewGo").disabled = true; this.busy(true);
    const r = await P.sew(pattern, dye).catch(() => ({ ok: false }));
    this.busy(false);
    if (r.ok) {
      const id = outfitId(pattern, dye), it = this.data.items[id];
      this._look.outfit = id;                       // 바로 입어 볼 수 있게 고른 상태로
      this.toast(`👕 ${it.name} 완성!\n'모습 고르기'에서 저장하면 가족 폰에도 보여요`, 2800);
      this.closetTab("look");
    } else { this.toast("만들지 못했어요 (" + (r.reason || "저장 실패") + ")"); this.renderSew(); }
  };
  // 미리보기: 옷 만들기 탭에서는 고른 무늬·색을 입혀서
  proto.drawClosetPrev = function () {
    const c = $("closetPrev"), g = c.getContext("2d"), t = performance.now() / 1000;
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 150, 190);
    g.fillStyle = "#7ab857"; for (let i = 0; i < 12; i++) g.fillRect((i * 37) % 150, (i * 53) % 190, 2, 5);
    const look = this._closetTab === "sew" ? { ...this._look, outfit: outfitId(this._sew.pattern, this._sew.dye) } : this._look;
    drawCharacter(g, look, this.data.appearance, 75, 170, 140, 0, t, false, null);
  };

  // ---- 오늘의 부탁 게시판 ----
  proto.boardOpen = function () { return !$("pBoard").hidden; };
  proto.openBoard = function () {
    const items = this.data.items, board = this.data.board, inv = (state.player && state.player.inv) || {};
    const list = RQ.list(), mine = RQ.incoming(), helped = (state.player && state.player.helped) || 0;
    $("boardSub").textContent = `가족에게 부탁하고, 가족 부탁을 들어줘요. 내 도움 도장 🏅 ${helped}개`;
    // 받을 물건(날짜 상관없이, 받는 중)
    const inc = Object.values(mine);
    $("boardIn").innerHTML = inc.length ? `<div class="inbox">💌 받을 물건: ${inc.map(r => `${(items[r.item] || {}).icon || "🎁"} ${esc((items[r.item] || {}).name || r.item)} ×${r.qty}(${esc(nameOf(r.from))})`).join(", ")} — 곧 가방에 들어와요</div>` : "";
    if (!RQ.ready()) $("boardList").innerHTML = `<p class="note">게시판을 불러오는 중…</p>`;
    else if (!list.length) $("boardList").innerHTML = `<p class="note">오늘은 아직 부탁이 없어요. 필요한 물건을 부탁해 보세요!</p>`;
    else $("boardList").innerHTML = list.map(r => {
      const it = items[r.item] || { icon: "🎁", name: r.item }, who = r.by === state.mid ? "내 부탁" : nameOf(r.by);
      const line = `${esc(it.name)} ${r.qty}개 갖다 줄래요?`;
      let right;
      if (r.done) right = `<small>✅ ${esc(nameOf(r.done.by))}${r.done.by === state.mid ? "(나)" : ""}가 들어줬어요</small>`;
      else if (r.by === state.mid) right = `<button class="btn ghost" type="button" data-cancel="${r.id}">지우기</button>`;
      else { const have = inv[r.item] || 0; right = have >= r.qty ? `<button class="btn" type="button" data-help="${r.id}">들어주기</button>` : `<small>내 가방 ${have}/${r.qty}</small>`; }
      return `<div class="req${r.done ? " done" : ""}"><span class="ri">${iconHtml(r.item, it.icon)}</span><div class="txt"><b>${esc(who)}</b> · ${line}${r.done ? "" : `<small>${r.by === state.mid ? "가족이 들어주면 가방으로 와요" : "들어주면 도움 도장 🏅 +1"}</small>`}</div>${right}</div>`;
    }).join("");
    $("boardList").querySelectorAll("[data-help]").forEach(b => b.onclick = () => this.boardHelp(b.dataset.help, b));
    $("boardList").querySelectorAll("[data-cancel]").forEach(b => b.onclick = async () => { b.disabled = true; const r = await RQ.cancel(b.dataset.cancel); if (!r.ok) this.toast(r.reason); this.openBoard(); });
    // 올리기 칸
    const slot = freeSlot(RQ.today(), state.mid, board.perPerson);
    $("boardPost").hidden = false;
    $("askGo").disabled = !slot || !RQ.ready();
    if (!$("askItem").options.length) {
      const order = ["material", "seed", "food", "fish"];
      $("askItem").innerHTML = askable(items, board).sort((a, b) => order.indexOf(items[a].kind) - order.indexOf(items[b].kind) || items[a].name.localeCompare(items[b].name, "ko"))
        .map(k => `<option value="${k}">${items[k].icon} ${esc(items[k].name)}</option>`).join("");
      $("askItem").value = "egg";
    }
    this.askPreview();
    if (!slot) $("askPreview").textContent = "오늘 부탁은 3개까지예요. 지운 자리에는 다시 올릴 수 있어요.";
    $("pBoard").hidden = false;
  };
  proto.askPreview = function () {
    const it = this.data.items[$("askItem").value]; this._askQty = this._askQty || 1;
    $("askQty").textContent = this._askQty;
    if (it) $("askPreview").textContent = `"${it.name} ${this._askQty}개 갖다 줄래요?" 로 올라가요`;
  };
  proto.boardHelp = async function (id, btn) {
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    btn.disabled = true; this.busy(true);
    const r = await RQ.help(id).catch(() => ({ ok: false, reason: "연결을 확인해 주세요" }));
    this.busy(false);
    if (r.ok) { const it = this.data.items[r.req.item]; this.toast(`🏅 도움 도장 +1!\n${it.icon} ${it.name} ×${r.req.qty}를 ${nameOf(r.req.by)}에게 보냈어요`, 2800); }
    else this.toast(r.reason || "들어주지 못했어요");
    this.openBoard();
  };
  proto.askPost = async function () {
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    $("askGo").disabled = true; this.busy(true);
    const item = $("askItem").value, r = await RQ.post(item, this._askQty || 1);
    this.busy(false);
    if (r.ok) { this.toast(`📋 부탁을 올렸어요! 가족이 들어주면 가방으로 와요`, 2400); this._askQty = 1; }
    else this.toast(r.reason || "올리지 못했어요");
    this.openBoard();
  };

  proto.bindV8 = function () {
    $("closetTabs").querySelectorAll("button").forEach(b => b.onclick = () => this.closetTab(b.dataset.t));
    $("sewGo").onclick = () => this.doSew();
    $("askItem").onchange = () => this.askPreview();
    $("askMinus").onclick = () => { this._askQty = Math.max(1, (this._askQty || 1) - 1); this.askPreview(); };
    $("askPlus").onclick = () => { this._askQty = Math.min(this.data.board.maxQty, (this._askQty || 1) + 1); this.askPreview(); };
    $("askGo").onclick = () => this.askPost();
    RQ.onRequests(() => { if (this.boardOpen()) this.openBoard(); });
  };
}
