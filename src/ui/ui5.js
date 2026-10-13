// v7 목장 화면: 씨앗 고르기(텃밭 빈 칸), 애완동물 고르기(동물 친구 집)
import { state } from "../state.js";
import { iconHtml } from "../game/sprites.js";
import * as FS from "../services/farmStore.js";
import { drawPet } from "../game/ranchArt.js";
import { josa } from "../config/gameConfig.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PET_NAME = { dog: "강아지", cat: "고양이", rabbit: "토끼" };

export function installV5(UI) {
  const proto = UI.prototype;

  // ---- 씨앗 고르기 ----
  proto.openPlant = function (plot) {
    this._plantPlot = plot;
    const farm = this.data.farm, items = this.data.items, inv = (state.player && state.player.inv) || {};
    const rows = farm.order.map(crop => {
      const c = farm.crops[crop], seed = items[c.seed], out = items[c.item], n = inv[c.seed] || 0;
      return `<button type="button" class="cell${n ? "" : " dim"}" data-crop="${crop}" ${n ? "" : "disabled"}><b>${iconHtml(c.item, out.icon)}</b>${esc(seed.name)}<small>${n}개 · ${c.ms / 60000}분</small></button>`;
    }).join("");
    $("plantGrid").innerHTML = rows;
    const none = farm.order.every(crop => !(inv[farm.crops[crop].seed] > 0));
    $("plantSub").textContent = none ? "씨앗이 없어요. 문 앞 씨앗 상자에서 받거나 작업대에서 만들어요(잡초 3개)." : "심을 씨앗을 골라요. 물을 주면 더 많이 거둬요!";
    $("plantGrid").querySelectorAll("button[data-crop]").forEach(b => b.onclick = () => { $("pPlant").hidden = true; this.game.ranch.plant(this._plantPlot, b.dataset.crop); });
    $("pPlant").hidden = false;
  };

  // ---- 애완동물 고르기 ----
  proto.openPet = function () {
    const cur = state.members[state.mid] && state.members[state.mid].pet;
    this._pet = { kind: (cur && cur.kind) || "dog" };
    $("petName").value = (cur && cur.name) || "";
    $("petSub").textContent = cur ? `지금 친구: ${PET_NAME[cur.kind]} '${cur.name}'. 바꿀 수도 있어요.` : "함께 다닐 동물 친구를 골라 이름을 지어 주세요.";
    this.renderPet();
    $("pPet").hidden = false;
  };
  proto.renderPet = function () {
    const k = this._pet.kind;
    $("petKinds").innerHTML = this.data.farm.pets.map(p => `<button type="button" data-k="${p}" aria-pressed="${p === k}"><canvas width="120" height="96" data-prev="${p}"></canvas><span>${PET_NAME[p]}</span></button>`).join("");
    $("petKinds").querySelectorAll("canvas[data-prev]").forEach(c => { const g = c.getContext("2d"); g.setTransform(2, 0, 0, 2, 0, 0); drawPet(g, c.dataset.prev, 30, 42, 52, false, 0, false, 0); });
    $("petKinds").querySelectorAll("button[data-k]").forEach(b => b.onclick = () => { this._pet.kind = b.dataset.k; this.renderPet(); });
  };
  proto.savePet = async function () {
    const name = $("petName").value.trim();
    if (!name) { this.toast("이름을 지어 주세요"); return; }
    if (name.length > 8) { this.toast("이름은 8글자까지예요"); return; }
    this.busy(true);
    try { await FS.savePet(this._pet.kind, name); $("pPet").hidden = true; this.toast(`🐾 ${josa(name, "이", "가")} 친구가 됐어요! 졸졸 따라다녀요`, 2400); }
    catch { this.toast("저장하지 못했어요. 연결을 확인해 주세요"); }
    this.busy(false);
  };
  proto.bindV5 = function () {
    $("petSave").onclick = () => this.savePet();
  };
}
