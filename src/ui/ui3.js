// v3 화면: 캠프파이어 창, 요리 창, 가족 추억, 우리 집 밖(겉모습·옮기기), 살금살금, 가방 먹기·놓아주기, 도감 탭
import { state, onState } from "../state.js";
import { nameOf, FAMILY, josa } from "../config/gameConfig.js";
import * as P from "../services/playerStore.js";
import * as H from "../services/houseStore.js";
import * as CS from "../services/campfireStore.js";
import * as SP from "../audio/songPlayer.js";
import { drawHouse } from "../game/houseArt.js";
import { validateExterior } from "../domain/houseAppearance.js";
import { isConnected } from "../services/fb.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ROAST_NAME = { raw: "덜 익음", golden: "노릇노릇", burnt: "탐" };

export function installV3(UI) {
  const proto = UI.prototype;

  proto.bindV3 = function () {
    $("bHouse").onclick = () => this.openHouse();
    $("bSneak").onclick = () => { const g = this.game; if (!g) return; g.sneak = !g.sneak; $("bSneak").setAttribute("aria-pressed", g.sneak); this.toast(g.sneak ? "살금살금… 천천히 걸어요" : "보통 걸음"); };
    $("campLight").onclick = () => this.campDo(() => this.game.camp.ignite());
    $("campRoast").onclick = () => { const m = this.game.camp.startRoast(); if (m) this.toast(m); else { $("pCamp").hidden = true; this.toast("막대가 초록 칸에 오면\n'꺼내기!'를 눌러요", 2200); } };
    $("campSing").onclick = () => this.campDo(() => this.game.camp.sing());
    $("campCook").onclick = () => { $("pCamp").hidden = true; this.openCook("camp"); };
    $("campMem").onclick = () => this.openMemories();
    $("campMute").onclick = () => { SP.setMuted(!SP.isMuted()); this.renderCamp(); };
    $("houseSave").onclick = () => this.saveHouse();
    $("houseMove").onclick = () => this.startHouseMove();
    $("moveCancel").onclick = () => { this.game.houseL.stopMove(); $("moveBar").hidden = true; };
    document.querySelectorAll("#dexTabs button").forEach(b => b.onclick = () => { this._dexTab = b.dataset.t; this.openDex(); });
    $("cookBtn").addEventListener("pointerdown", e => { e.preventDefault(); if (this._cookSpot) this.openCook(this._cookSpot); });
    $("bHelp").onclick = () => this.openHelp(this._helpTab || "cook");
    document.querySelectorAll("#helpTabs button").forEach(b => b.onclick = () => this.openHelp(b.dataset.t));
    onState(w => {
      if (w === "camp" && !$("pCamp").hidden) this.renderCamp();
      if (w === "player") { if (!$("pCook").hidden) this.openCook(this._cookAt); this.updateV3Buttons(); }
    });
    setInterval(() => this.updateV3Buttons(), 700);
  };

  // 섬에서 우리 집 근처면 '우리 집 밖', 잠자리채가 있으면 '살금살금', 옮기는 중엔 안내 줄
  proto.updateV3Buttons = function () {
    const g = this.game; if (!g) return;
    const h = g.world.houseOf(state.mid);
    const nearHome = g.mode === "island" && h && Math.abs(g.me.x - (h.x + 3)) < 7 && Math.abs(g.me.y - (h.y + 3)) < 6 && !g.houseL.move;
    $("bHouse").hidden = !nearHome;
    $("bSneak").hidden = !(g.mode === "island" && g.bugs.hasNet());
    if (g.houseL.move) { $("moveBar").hidden = false; $("moveWhy").textContent = g.houseL.reasonText(); }
    else $("moveBar").hidden = true;
  };

  // ---- 캠프파이어 ----
  proto.openCamp = function () { this.renderCamp(); $("pCamp").hidden = false; };
  proto.renderCamp = function () {
    const c = this.game.camp, open = c.eveningOn(), lit = c.lit(), fam = c.atFire();
    $("campStat").textContent = !open ? "가족 2명 이상이 캠프 자리에 모이면 언제든 캠프파이어를 해요 🌙"
      : lit ? `불이 활활! 지금 ${fam.length}명 모였어요 ${fam.map(m => nameOf(m)).join("·")}` : "아직 불이 없어요. 나뭇가지로 불을 붙여요";
    $("campSub").textContent = lit ? `오늘 마시멜로 ${c.roastsLeft()}번 남음 · 3명 이상 모이면 불꽃놀이!` : "";
    $("campLight").hidden = !open || lit;
    for (const id of ["campRoast", "campSing", "campCook"]) $(id).hidden = !lit;
    $("campMute").textContent = SP.isMuted() ? "🔇 소리 켜기" : "🔈 소리 끄기";
  };
  proto.campDo = async function (fn) {
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    this.busy(true); const m = await fn().catch(() => "잠시 후 다시 해 주세요"); this.busy(false);
    this.toast(m); this.renderCamp();
  };
  proto.openMemories = async function () {
    $("pMem").hidden = false; $("memList").innerHTML = `<p class="note">불러오는 중…</p>`;
    try {
      const list = await CS.readMemories();
      $("memList").innerHTML = list.length ? list.map(d => {
        const date = new Date(d.day * 86400000);   // KST 일 번호 → 날짜(UTC 기준으로 그 날)
        const who = Object.keys(d.attendance || {}).sort();
        const roasts = Object.entries(d.roasts || {}).map(([m, r]) => `${esc(nameOf(m))} ${Object.values(r).map(x => ROAST_NAME[x] || x).join("·")}`).join(" / ");
        return `<div class="mem"><b>${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일</b>${who.length >= FAMILY.length ? " 🌟 모두 모였어요!" : ""}${d.fireworks ? " 🎆 불꽃놀이!" : ""}<div>모인 가족: ${who.map(m => esc(nameOf(m))).join(", ") || "-"}</div>${roasts ? `<div class="note">🍡 ${roasts}</div>` : ""}</div>`;
      }).join("") : `<p class="note">아직 기록이 없어요. 저녁에 캠프파이어에 모여 봐요!</p>`;
    } catch { $("memList").innerHTML = `<p class="note">불러오지 못했어요. 연결을 확인해 주세요.</p>`; }
  };

  // 요리할 수 있는 곳 앞이면 '요리하기' 버튼 보이기 (spot: "stove" | "camp" | null)
  proto.setCook = function (spot) {
    this._cookSpot = spot;
    const hide = !spot || this.modalOpen();
    if ($("cookBtn").hidden !== hide) $("cookBtn").hidden = hide;
  };

  // ---- 요리 ---- at: "camp" | "stove"
  proto.openCook = function (at) {
    this._cookAt = at;
    $("cookSub").textContent = (at === "camp" ? "🔥 캠프파이어에서 요리해요." : "🍳 조리대에서 요리해요.") + " 재료 얻는 곳은 '도움말 → 요리법'에 있어요. 만든 요리는 가방에서 '먹기'!";
    const inv = state.player ? state.player.inv : {}, items = this.data.items, recipes = this.data.cooking.recipes;
    const have = k => k.startsWith("kind:") ? Object.entries(inv).filter(([id, n]) => n > 0 && items[id] && items[id].kind === k.slice(5)).reduce((a, [, n]) => a + n, 0) : (inv[k] || 0);
    const label = k => k === "kind:fish" ? "물고기(아무거나)" : (items[k] || {}).name || k;
    $("cookList").innerHTML = Object.entries(recipes).map(([id, r]) => {
      const ok = Object.entries(r.items).every(([k, n]) => have(k) >= n), out = items[r.out] || { icon: "🍽️", name: r.out };
      const need = Object.entries(r.items).map(([k, n]) => `${esc(label(k))} ${have(k)}/${n}`).join(" · ");
      return `<div class="recipe"><span class="ri">${out.icon}</span><div class="name">${esc(out.name)}<small>${need}</small></div><button class="btn${ok ? "" : " ghost"}" type="button" data-k="${id}" ${ok ? "" : "disabled"}>만들기</button></div>`;
    }).join("");
    $("cookList").querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
      if (at === "camp" && !this.game.camp.lit()) { this.toast("불이 꺼졌어요. 집 조리대에서도 만들 수 있어요"); return; }
      b.disabled = true; this.busy(true);
      const r = await P.cookDish(b.dataset.k, this.data.cooking, items).catch(() => ({ ok: false }));
      this.busy(false);
      const out = items[recipes[b.dataset.k].out];
      this.toast(r.ok ? `${out.icon} ${out.name} 완성! 가방에 있어요` : (r.reason || "만들지 못했어요"));
      this.openCook(at);
    });
    $("pCook").hidden = false;
  };

  // 가방 칸 아래 작은 버튼(음식 먹기·곤충 놓아주기)
  proto.bagAction = function (k) {
    const it = this.data.items[k]; if (!it) return "";
    if (it.kind === "food") return `<button class="mini" type="button" data-eat="${k}">먹기</button>`;
    if (it.kind === "insect") return `<button class="mini" type="button" data-free="${k}">놓아주기</button>`;
    return "";
  };
  proto.bindBagActions = function () {
    $("bagGrid").querySelectorAll("[data-eat]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      const r = await P.eatFood(b.dataset.eat, this.data.items, Date.now()).catch(() => ({ ok: false }));
      if (!r.ok) { this.toast(r.reason || "먹지 못했어요"); b.disabled = false; return; }
      $("pBag").hidden = true;
      const { sendEmote } = await import("../services/emoteStore.js");
      sendEmote("yum").catch(() => {});
      const it = this.data.items[b.dataset.eat];
      this.toast(`냠냠! ${it.icon} ${it.name}${r.first ? "\n요리 도감에 새로 올랐어요 ✨" : ""}`);
    });
    $("bagGrid").querySelectorAll("[data-free]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      const r = await P.freeInsect(b.dataset.free).catch(() => ({ ok: false }));
      this.toast(r.ok ? `${josa(this.data.items[b.dataset.free].name, "을", "를")} 놓아줬어요. 잘 가!` : "놓아주지 못했어요");
    });
  };

  // 도감: 곤충·요리 탭
  proto.dexBugs = function () {
    const dex = (state.player && state.player.insectDex) || {}, sp = this.data.insects.species, ids = Object.keys(sp);
    const BAND = { day: "낮", evening: "저녁", night: "밤" }, PLACE = { flower: "꽃", tree: "나무", water: "물가", sand: "모래", grass: "풀밭" };
    $("dexSub").textContent = `${ids.filter(i => dex[i]).length} / ${ids.length}종 잡았어요`;
    $("dexGrid").innerHTML = ids.map(i => { const it = this.data.items["insect_" + i] || { icon: "🐞", name: i };
      return dex[i] ? `<div class="cell"><b>${it.icon}</b>${esc(it.name)}<small>${dex[i].count}마리</small></div>`
        : `<div class="cell dim"><b>❔</b>???<small>${sp[i].bands.map(b => BAND[b]).join("·")} ${sp[i].places.map(p => PLACE[p]).join("·")}</small></div>`; }).join("");
  };
  proto.dexFood = function () {
    const dex = (state.player && state.player.cookDex) || {}, foods = Object.entries(this.data.items).filter(([, it]) => it.kind === "food");
    $("dexSub").textContent = `${foods.filter(([k]) => dex[k]).length} / ${foods.length}가지 먹어 봤어요`;
    $("dexGrid").innerHTML = foods.map(([k, it]) => dex[k]
      ? `<div class="cell"><b>${it.icon}</b>${esc(it.name)}<small>${dex[k].count}번 먹음</small></div>`
      : `<div class="cell dim"><b>❔</b>???<small>&nbsp;</small></div>`).join("");
  };

  // ---- 우리 집 밖 ----
  proto.openHouse = function () {
    const g = this.game;
    this._ext = { ...g.houseL.extOf(state.mid) };
    this.renderHouse(); $("pHouse").hidden = false;
  };
  proto.renderHouse = function () {
    const E = this._ext, d = this.data.houseAppearance;
    const T = { gable: "세모", round: "둥근", hip: "사다리꼴", square: "네모", arch: "둥근", cross: "십자", post: "기둥", wall: "벽걸이", none: "없음", wood: "나무", stone: "돌담" };
    const chips = (key, list, lab) => `<div><span class="lab">${lab}</span><div class="chips">${list.map(v => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${E[key] === v}">${T[v] || v}</button>`).join("")}</div></div>`;
    const sw = (key, cols, lab) => `<div><span class="lab">${lab}</span><div class="sw">${cols.map((c, i) => `<button type="button" aria-label="${lab} ${i + 1}" data-k="${key}" data-i="${i}" style="background:${c}" aria-pressed="${E[key] === i}"></button>`).join("")}</div></div>`;
    $("houseOpts").innerHTML = chips("roofShape", d.roofShapes, "지붕 모양") + sw("roofColor", d.roofColors, "지붕색") + sw("wallColor", d.wallColors, "벽색")
      + chips("doorShape", d.doorShapes, "문 모양") + sw("doorColor", d.doorColors, "문색") + chips("windowShape", d.windowShapes, "창문")
      + chips("mailbox", d.mailboxes, "우편함") + chips("fence", d.fences, "울타리");
    $("houseOpts").querySelectorAll("button").forEach(b => b.onclick = () => { E[b.dataset.k] = b.dataset.i !== undefined ? +b.dataset.i : b.dataset.v; this.renderHouse(); });
    const c = $("housePrev"), g = c.getContext("2d"); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 200, 186);
    g.fillStyle = "#9fd57f"; g.fillRect(0, 0, 200, 186); g.fillStyle = "#8cc76a"; for (let i = 0; i < 24; i++) g.fillRect((i * 67) % 200, (i * 43) % 186, 2, 5);
    drawHouse(g, E, d, nameOf(state.mid), 28, 30, 24);
  };
  proto.saveHouse = async function () {
    const v = validateExterior(this._ext, this.data.houseAppearance);
    if (!v.ok) { this.toast("고른 모양을 저장할 수 없어요"); return; }
    this.busy(true);
    try { await H.saveExterior(v.ext); $("pHouse").hidden = true; this.toast("우리 집이 새로워졌어요! 🏠"); }
    catch { this.toast("저장하지 못했어요. 연결을 확인해 주세요"); }
    this.busy(false);
  };
  proto.startHouseMove = function () {
    const g = this.game, c = g.houseL.canStartMove();
    if (!c.ok) { this.toast(`가족 모두 새 버전으로 한 번 들어와야 집을 옮길 수 있어요\n(아직: ${c.who.join(", ")})`, 3500); return; }
    $("pHouse").hidden = true;
    g.houseL.startMove();
    this.toast("원하는 곳으로 걸어가요\n초록 테두리일 때 '여기로 옮기기'!", 3000);
  };
  proto.houseMoveDone = function (r) {
    if (r.ok) { $("moveBar").hidden = true; this.toast("이사 완료! 🏠✨\n가족 모두의 섬에 새 자리로 보여요", 2600); }
    else this.toast(r.reason || "여기엔 지을 수 없어요");
  };

  // ---- 도움말: 요리법(재료·얻는 곳) / 만들기(작업대) / 하는 방법 ----
  proto.openHelp = function (tab) {
    this._helpTab = tab;
    document.querySelectorAll("#helpTabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === tab));
    const items = this.data.items, help = this.data.help, inv = (state.player && state.player.inv) || {};
    const name = k => k === "kind:fish" ? "물고기(아무거나)" : (items[k] || {}).name || k;
    const have = k => k.startsWith("kind:") ? Object.entries(inv).filter(([id, n]) => n > 0 && items[id] && items[id].kind === k.slice(5)).reduce((a, [, n]) => a + n, 0) : (inv[k] || 0);
    const need = list => Object.entries(list).map(([k, n]) => `${esc(name(k))} ${n}개 <span class="src">(${esc(help.sources[k] || "")}${have(k) ? ` · 가진 것 ${have(k)}` : ""})</span>`).join("<br>");
    let html = "";
    if (tab === "cook") {
      html = `<p class="sub">요리는 <b>불 붙은 캠프파이어</b>(가족 2명 이상 모였을 때) 앞이나 <b>집 조리대</b> 앞에서 '🍳 요리하기'를 눌러 만들어요. 조리대는 작업대에서 만들어요.</p>`
        + Object.values(this.data.cooking.recipes).map(r => { const o = items[r.out] || { icon: "🍽️", name: r.out };
          return `<div class="help-item"><b>${o.icon} ${esc(o.name)}</b>${need(r.items)}</div>`; }).join("");
    } else if (tab === "craft") {
      html = `<p class="sub">거실의 작업대(망치) 앞에서 '만들기'를 눌러요.</p>`
        + Object.values(this.data.recipes).map(r => { const o = this.craftOut(r);
          return `<div class="help-item"><b>${o.icon} ${esc(o.name)}</b>${need(r.items)}</div>`; }).join("");
    } else {
      html = help.howto.map(([t, d]) => `<div class="help-item"><b>${esc(t)}</b>${esc(d)}</div>`).join("");
    }
    $("helpBody").innerHTML = html;
    $("pHelp").hidden = false; $("cookBtn").hidden = true;
  };
}
