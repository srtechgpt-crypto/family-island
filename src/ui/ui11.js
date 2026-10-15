// v11 화면: 섬 발전 게시판(공사 재료 넣기·진행 막대·함께한 가족)
import { state } from "../state.js";
import { iconHtml } from "../game/sprites.js";
import * as IS from "../services/isleStore.js";
import { isConnected } from "../services/fb.js";
import { progress, builtSet, currentProject, MIDS } from "../domain/isle.js";
import { nameOf, familyOf } from "../config/gameConfig.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function installV11(UI) {
  const proto = UI.prototype;
  proto.isleOpen = function () { return !$("pIsle").hidden; };
  proto.openIsle = function () {
    const cfg = this.data.isle, items = this.data.items, inv = (state.player && state.player.inv) || {}, gives = IS.isleGives();
    const b = builtSet(gives, cfg), cur = currentProject(gives, cfg);
    if (!IS.isleReady()) { $("isleBody").innerHTML = `<p class="note">게시판을 불러오는 중…</p>`; $("pIsle").hidden = false; return; }
    const row = p => {
      if (b.has(p.id)) return `<div class="isleP done"><span class="ip">${p.icon}</span><div class="txt"><b>${esc(p.name)}</b> ✅ 완성!<small>${esc(p.desc)}</small></div></div>`;
      if (!cur || p.id !== cur.id) return `<div class="isleP lock"><span class="ip">🔒</span><div class="txt"><b>${esc(p.name)}</b><small>앞 공사가 끝나면 열려요</small></div></div>`;
      const pr = progress(gives, p);
      const lines = Object.entries(p.need).map(([k, need]) => {
        const it = items[k] || { icon: "📦", name: k }, have = Math.min(need, pr.have[k]), left = need - have, mine = inv[k] || 0;
        const btns = left <= 0 ? `<small class="ok">다 찼어요 👍</small>`
          : mine <= 0 ? `<small>가방에 없어요</small>`
          : [1, 5].filter(n => n < Math.min(left, mine)).map(n => `<button class="btn ghost" type="button" data-give="${k}" data-n="${n}">+${n}</button>`).join("")
            + `<button class="btn" type="button" data-give="${k}" data-n="${Math.min(left, mine)}">${Math.min(left, mine)}개 넣기</button>`;
        return `<div class="isleI"><span class="ri">${iconHtml(k, it.icon)}</span><div class="txt"><b>${esc(it.name)}</b> ${have}/${need}<div class="bar"><i style="width:${Math.floor(have * 100 / need)}%"></i></div><small>내 가방 ${mine}개</small></div><div class="gb">${btns}</div></div>`;
      }).join("");
      const who = MIDS.filter(m => pr.by[m]).sort((a, c) => pr.by[c] - pr.by[a]).map(m => `<span style="color:${familyOf(m).color}">${esc(nameOf(m))} ${pr.by[m]}</span>`).join(" · ");
      return `<div class="isleP now"><span class="ip">${p.icon}</span><div class="txt"><b>${esc(p.name)}</b> — ${pr.pct}%<div class="bar big"><i style="width:${pr.pct}%"></i></div><small>${esc(p.desc)}</small></div></div>${lines}<p class="note">🤝 함께한 가족: ${who || "아직 없어요. 처음으로 넣어 볼까요?"}</p>`;
    };
    $("isleSub").textContent = cur ? "가족이 함께 재료를 넣으면 섬에 새 곳이 생겨요. 완성되면 모두에게 기념 가구 선물!" : "모든 공사를 끝냈어요! 고마워요, 우리 가족 🎉";
    $("isleBody").innerHTML = cfg.projects.map(row).join("");
    $("isleBody").querySelectorAll("[data-give]").forEach(btn => btn.onclick = () => this.isleGive(cur.id, btn.dataset.give, +btn.dataset.n, btn));
    $("pIsle").hidden = false;
  };
  proto.isleGive = async function (pid, item, n, btn) {
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    $("isleBody").querySelectorAll("button").forEach(b => b.disabled = true); this.busy(true);
    const r = await IS.donate(pid, item, n).catch(() => ({ ok: false, reason: "연결을 확인해 주세요" }));
    this.busy(false);
    const it = this.data.items[item] || { icon: "📦", name: item };
    if (r.ok) this.toast(`🏗️ ${it.icon} ${it.name} ${r.q}개를 넣었어요! 고마워요`, 2200);
    else this.toast(r.reason || "넣지 못했어요");
    if (this.isleOpen()) this.openIsle();
  };
  proto.bindV11 = function () {
    IS.onIsle(e => {
      if (e && e.done) this.isleCelebrate(e.done);
      if (this.isleOpen() && !IS.isDonating()) this.openIsle();
    });
  };
  // 공사 완성 + 이 폰에서 기념 가구를 받은 순간(한 곳에서만 축하)
  proto.isleCelebrate = function (p) {
    const f = this.data.furniture[p.reward];
    this.game && this.game.isle && this.game.isle.celebrate(p);
    this.toast(`🎉 ${p.name} 완성!\n기념 가구 '${f ? f.name : p.reward}'가 보관함에 들어왔어요`, 4200);
  };
}
