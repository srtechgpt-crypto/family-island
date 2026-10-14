// v10 화면: 캠프 창 '🎉 이벤트' 칸(보물찾기), 보물찾기 결과, 생일 잔치 창(축하 카드·선물함), 가족 관리 '가족 생일'
import { state, onState } from "../state.js";
import { FAMILY, nameOf, josa, familyOf } from "../config/gameConfig.js";
import { serverNow, isConnected } from "../services/fb.js";
import * as EV from "../services/eventStore.js";
import * as P from "../services/playerStore.js";
import { huntPhase, huntResult, validHunt, canStartAt } from "../domain/hunt.js";
import { BDAY_RE, CARD_EMO, CARD_MSG, MSG_MAX, birthdaysToday, giftFor, cardKey, validCard } from "../domain/bday.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dateOf = day => { const d = new Date(day * 86400000); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };

export function installV10(UI) {
  const proto = UI.prototype;

  proto.bindV10 = function () {
    $("evHunt").onclick = async () => {
      const ev = this.game && this.game.events; if (!ev) return;
      $("evHunt").disabled = true;
      const m = await ev.start().catch(() => "보물찾기를 열지 못했어요");
      $("evHunt").disabled = false;
      if (m) { this.toast(m, 2400); this.renderCamp(); return; }
      $("pCamp").hidden = true;
      this.toast("💎 보물찾기를 열었어요!\n10초 뒤에 섬 곳곳에 보물 상자가 나타나요", 3000);
    };
    $("evHuntRes").onclick = () => { if (validHunt(state.hunt)) this.showHuntResult(state.hunt, true); };
    $("huntGo").onclick = () => { const g = this.game; if (g && g.mode === "house") { g.leaveHouse(); this.toast("💎 섬 곳곳의 반짝이는 상자를 찾아봐요!"); } };
    $("bBday").onclick = () => this.openBday(true);
    onState(w => {
      if (w === "hunt" && !$("pCamp").hidden) this.renderCamp();
      // 생일 값이 바뀔 때만(위치·접속 시각 갱신으로 자주 오는 members 알림은 넘김)
      if (w === "members") { const sig = FAMILY.map(f => (state.members[f.mid] && state.members[f.mid].bday) || "").join(","); if (sig !== this._bdSig) { this._bdSig = sig; this.updateBday(); } }
      if (w === "cards") { this.updateBday(); this.refreshBday(false); }
    });
  };

  // ---- 캠프 창: 불이 붙어 있으면 이벤트 칸 ----
  const baseRender = proto.renderCamp;
  proto.renderCamp = function () {
    baseRender.call(this);
    const c = this.game.camp, h = validHunt(state.hunt) ? state.hunt : null, ph = huntPhase(h, serverNow());
    $("campEvt").hidden = !c.canUse();
    const busy = ph === "count" || ph === "run";
    $("evHunt").textContent = busy ? "💎 보물찾기 하는 중!" : "💎 보물찾기";
    $("evHunt").disabled = busy;
    $("evHuntRes").hidden = !(h && ph === "done");
    $("evNote").textContent = busy ? "섬 곳곳을 돌아다니며 반짝이는 상자를 찾아요!"
      : !canStartAt(serverNow()) ? "밤 11시 55분이 넘어서 오늘 보물찾기는 끝이에요"
      : "누르면 10초 뒤 섬 곳곳에 보물 상자 10개가 숨겨져요. 먼저 연 사람이 보석을 받아요!";
  };

  // ---- 보물찾기 결과(끝나면 저절로, 캠프 창에서 다시 보기) ----
  proto.showHuntResult = function (h) {
    const r = huntResult(h), rows = Object.entries(r.count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    $("huntResSub").textContent = r.total >= 10 ? "보물 10개를 모두 찾았어요! 🎉" : r.total ? `5분 동안 보물 ${r.total}개를 찾았어요` : "아무도 못 찾았어요. 다음엔 꼭 찾아봐요!";
    $("huntResList").innerHTML = rows.map(([m, n]) => `<div class="hres"><span class="crown">${r.winners.includes(m) ? "👑" : ""}</span><i style="background:${(familyOf(m) || {}).color || "#999"}"></i>${esc(nameOf(m))}<span style="margin-left:auto">💎 ${n}개</span></div>`).join("")
      + (r.winners.length > 1 ? `<p class="note">공동 1등이에요!</p>` : "");
    this._resId = h.id;
    this.closeAll(); $("pHuntRes").hidden = false;
  };
  // 결과 창이 열려 있는데 같은 판 기록이 늦게 바뀌면(서버 확정) 다시 그림
  proto.refreshHuntResult = function (h) {
    if ($("pHuntRes").hidden || !h || h.id !== this._resId) return;
    const r = huntResult(h), rows = Object.entries(r.count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    $("huntResSub").textContent = r.total >= 10 ? "보물 10개를 모두 찾았어요! 🎉" : r.total ? `5분 동안 보물 ${r.total}개를 찾았어요` : "아무도 못 찾았어요. 다음엔 꼭 찾아봐요!";
    $("huntResList").innerHTML = rows.map(([m, n]) => `<div class="hres"><span class="crown">${r.winners.includes(m) ? "👑" : ""}</span><i style="background:${(familyOf(m) || {}).color || "#999"}"></i>${esc(nameOf(m))}<span style="margin-left:auto">💎 ${n}개</span></div>`).join("")
      + (r.winners.length > 1 ? `<p class="note">공동 1등이에요!</p>` : "");
  };
  proto.setHuntGo = function (on) { if ($("huntGo").hidden === on) $("huntGo").hidden = !on; };

  // ---- 생일: 🎂 버튼(오늘 생일이 있거나 안 연 선물이 있을 때) ----
  proto.updateBday = async function () {
    const today = birthdaysToday(state.members, serverNow());
    let unopened = 0;
    try { unopened = (await EV.myCards()).filter(c => !(state.player && state.player.done && state.player.done[cardKey(c.day, c.from)])).length; } catch { /* 못 읽으면 0 */ }
    this._bdUnopened = unopened;
    $("bBday").hidden = !(today.length || unopened);
    $("bBday").textContent = unopened ? `🎁 선물 ${unopened}` : "🎂 생일";
    const key = today.join(",") + "|" + EV.cardsDay();
    if (today.length && this._bdToast !== key) {
      this._bdToast = key;
      setTimeout(() => this.toast(`🎂 오늘은 ${today.map(m => nameOf(m)).join("·")}의 생일이에요!\n위쪽 🎂를 눌러 축하해 줘요`, 4000), 2500);
    }
  };
  // 카드를 쓰는 중이면 창을 다시 그리지 않음(쓴 글이 지워지지 않게)
  proto.bdayTyping = function () { return [...document.querySelectorAll("#bdayBody input")].some(i => i.value); };
  // 열린 생일 창 다시 그리기: 쓰는 중이면 건너뜀(날이 바뀌었으면 force — 지난 날짜 양식은 버림)
  proto.refreshBday = function (force) { if (!$("pBday").hidden && (force || !this.bdayTyping())) this.openBday(false); };
  // user = 사람이 버튼으로 연 것. 그리는 도중(카드 읽기 기다림) 창을 닫았거나 다시 그리기가 새로 시작됐거나 글을 쓰기 시작했으면 그만둠
  proto.openBday = async function (user) {
    if (user) $("toast").hidden = true;
    const gen = (this._bdGen = (this._bdGen || 0) + 1), formDay = EV.cardsDay();
    const now = serverNow(), today = birthdaysToday(state.members, now), mine = today.includes(state.mid);
    const others = today.filter(m => m !== state.mid), cards = state.cardsToday || {};
    let html = "";
    for (const m of others) {
      const sent = cards[m] && cards[m][state.mid];
      html += `<div class="admin-sec"><b>🎂 오늘은 ${esc(nameOf(m))}의 생일!</b>`;
      if (sent && validCard(sent)) html += `<div class="card10"><span class="emo">${esc(sent.emo)}</span>${esc(sent.msg)}<div class="note">보낸 카드예요. ${esc(josa(nameOf(m), "이", "가"))} 선물함에서 열어 볼 거예요</div></div>`;
      else html += `<p class="note">축하 카드를 보내면 ${esc(nameOf(m))}에게 선물 상자가 가요.</p>
        <div class="emopick" data-to="${m}">${CARD_EMO.map((e, i) => `<button type="button" data-emo="${e}" aria-pressed="${i === 0}">${e}</button>`).join("")}</div>
        <div class="chips" data-msgs="${m}">${CARD_MSG.map(s => `<button type="button" data-msg="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <input type="text" id="cardMsg_${m}" maxlength="${MSG_MAX}" placeholder="직접 쓰기 (${MSG_MAX}글자까지)" style="margin-top:6px">
        <div class="row" style="justify-content:flex-start"><button class="btn" type="button" data-send="${m}">💌 카드 보내기</button></div>`;
      html += `</div>`;
    }
    // 내 선물함: 나에게 온 카드(지난 생일 포함)
    let list = [];
    try { list = await EV.myCards(); } catch { /* 아래 안내 */ }
    if (mine || list.length) {
      html += `<div class="admin-sec"><b>🎁 내 선물함</b>${mine ? `<p class="note">생일 축하해요! 가족이 보낸 카드를 열어 봐요.</p>` : ""}`;
      html += list.length ? list.map(c => {
        const ok = validCard(c.card), got = state.player && state.player.done && state.player.done[cardKey(c.day, c.from)];
        return `<div class="card10"><span class="who">${esc(nameOf(c.from))} · ${dateOf(c.day)}</span><div><span class="emo">${ok ? esc(c.card.emo) : "💌"}</span>${ok ? esc(c.card.msg) : ""}</div>
          <div class="row" style="justify-content:flex-start;margin:4px 0 0">${got ? `<span class="note">받았어요 ✓</span>` : `<button class="btn" type="button" data-open="${c.day}|${c.from}">🎁 상자 열기</button>`}</div></div>`;
      }).join("") : `<p class="note">아직 온 카드가 없어요. 조금 기다려 봐요!</p>`;
      html += `</div>`;
    }
    if (!html) html = `<p class="note">오늘은 생일인 가족이 없어요.</p>`;
    if (gen !== this._bdGen || (!user && ($("pBday").hidden || this.bdayTyping() && formDay === this._bdFormDay))) return;
    this._bdFormDay = formDay;
    $("bdayBody").innerHTML = html;
    const body = $("bdayBody");
    body.querySelectorAll(".emopick button").forEach(b => b.onclick = () => { b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); });
    body.querySelectorAll("[data-msgs] button").forEach(b => b.onclick = () => { $("cardMsg_" + b.parentElement.dataset.msgs).value = b.dataset.msg; });
    body.querySelectorAll("[data-send]").forEach(b => b.onclick = async () => {
      const to = b.dataset.send, emo = body.querySelector(`.emopick[data-to="${to}"] button[aria-pressed="true"]`)?.dataset.emo || CARD_EMO[0];
      const msg = $("cardMsg_" + to).value.trim();
      if (!msg) { this.toast("축하 말을 고르거나 써 주세요"); return; }
      if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
      // 보내기 직전 다시 확인: 그린 뒤 날이 바뀌었거나 생일이 바뀌었으면 보내지 않음
      if (formDay !== EV.cardsDay() || !birthdaysToday(state.members, serverNow()).includes(to)) { this.toast("날짜가 바뀌었어요. 다시 열어 주세요"); this.openBday(false); return; }
      b.disabled = true;
      try { await EV.sendCard(formDay, to, emo, msg.slice(0, MSG_MAX)); this.toast(`💌 ${nameOf(to)}에게 카드를 보냈어요!`); $("cardMsg_" + to).value = ""; this.openBday(false); }
      catch { this.toast("보내지 못했어요. 이미 보냈는지 볼게요"); b.disabled = false; }
    });
    body.querySelectorAll("[data-open]").forEach(b => b.onclick = async () => {
      const [day, from] = b.dataset.open.split("|"), gift = giftFor(+day, from, this.game.data.events.bday.gifts);
      b.disabled = true; this.busy(true);
      const r = await P.openCardTx(+day, from, gift, this.game.data.items).catch(() => ({ ok: false }));
      this.busy(false);
      if (!r.ok) { this.toast("열지 못했어요. 다시 눌러 봐요"); b.disabled = false; return; }
      const it = this.game.data.items[gift.item] || { icon: "🎁", name: gift.item };
      this.toast(`🎁 ${nameOf(from)}의 선물!\n🍰 생일 케이크 조각 + ${it.icon} ${it.name} ×${gift.qty}`, 3000);
      this.updateBday(); this.openBday(false);
    });
    $("pBday").hidden = false;
  };

  // ---- 가족 관리: 가족 생일(월·일) ----
  const baseNames = proto.renderNames;
  proto.renderNames = function () { baseNames.call(this); this.renderBdays(); };
  proto.renderBdays = function () {
    const opt = (n, sel) => Array.from({ length: n }, (_, i) => i + 1).map(v => `<option value="${String(v).padStart(2, "0")}" ${sel === v ? "selected" : ""}>${v}</option>`).join("");
    $("bdayList").innerHTML = FAMILY.map(f => {
      const b = state.members[f.mid] && state.members[f.mid].bday, [mm, dd] = BDAY_RE.test(b || "") ? b.split("-").map(Number) : [0, 0];
      return `<div class="bdrow"><span class="name">${esc(nameOf(f.mid))}</span>
        <select id="bdM_${f.mid}"><option value="">월</option>${opt(12, mm)}</select>월
        <select id="bdD_${f.mid}"><option value="">일</option>${opt(31, dd)}</select>일
        <button class="btn ghost" type="button" data-bd="${f.mid}">저장</button>${b ? `<button class="btn ghost" type="button" data-bdx="${f.mid}">지우기</button>` : ""}</div>`;
    }).join("");
    $("bdayList").querySelectorAll("[data-bd]").forEach(b => b.onclick = async () => {
      const mid = b.dataset.bd, v = `${$("bdM_" + mid).value}-${$("bdD_" + mid).value}`;
      if (!BDAY_RE.test(v)) { this.toast("없는 날짜예요. 월과 일을 다시 골라 주세요"); return; }
      try { await EV.setBday(mid, v); this.toast(`${nameOf(mid)} 생일을 ${+v.slice(0, 2)}월 ${+v.slice(3)}일로 넣었어요`); } catch (e) { this.toast("저장하지 못했어요"); }
    });
    $("bdayList").querySelectorAll("[data-bdx]").forEach(b => b.onclick = async () => {
      try { await EV.setBday(b.dataset.bdx, null); this.toast("생일을 지웠어요"); } catch { this.toast("지우지 못했어요"); }
    });
  };
}
