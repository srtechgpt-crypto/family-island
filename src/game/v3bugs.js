// v3 곤충: 사람마다 10분마다 새로 나타남(각 폰이 같은 계산), 잠자리채로 잡기, 살금살금. 벌집 줍기
import { drawInsect, drawNetSwing } from "./insectArt.js";
import { insectSlot, timeBand, spawnInsects } from "../domain/insects.js";
import { honeyTrees, honeySpot } from "../domain/honey.js";
import { zoneOf } from "../domain/rounds.js";
import { serverNow } from "../services/fb.js";
import * as W from "../services/worldStore.js";
import * as P from "../services/playerStore.js";
import { state } from "../state.js";
import { josa } from "../config/gameConfig.js";

export class BugLayer {
  constructor(game) {
    this.game = game;
    this.def = game.data.insects;
    this.key = null; this.list = [];
    this.swing = null;            // { x, y, t0 }
    this.flying = new Map();      // instId → 날아가는 모습 시작 시각
    this.near = new Map();        // instId → 빨리 다가온 시간(초)
    this.trees = game.world.objects.filter(o => o.k === "tree");
    this.honeyRound = null; this.honey = [];
  }
  hasNet() { return (state.player && state.player.inv && state.player.inv.tool_net || 0) > 0; }

  // 지금 조각의 곤충(잡았거나 도망간 것, 집에 가린 것은 빼고)
  current() {
    const now = serverNow(), slot = insectSlot(now), band = timeBand(now), key = slot + band;
    if (key !== this.key) { this.key = key; this.slot = slot; this.list = spawnInsects(this.def, state.fid, state.mid, slot, band); this.flying.clear(); this.near.clear(); }
    const v = (state.player && state.player.insectVisit) || {};
    const same = v.slot === this.slot;
    return this.list.filter(i => !(same && ((v.caught || {})[i.id] || (v.fled || {})[i.id])) && !this.game.world.inHouse(i.x, i.y) && !this.flying.has(i.id));
  }
  // 곤충이 살짝 움직이는 자리(그림·잡기 판정 같이 씀)
  posOf(i, t) { const ph = (i.x * 7 + i.y * 13) % 10; return { x: i.x + 0.5 + Math.sin(t * 0.7 + ph) * 0.25, y: i.y + 0.5 + Math.cos(t * 0.5 + ph) * 0.2, ph }; }

  // 매 프레임: 민감한 곤충은 보통 걸음으로 3칸 안에 0.5초 넘게 다가오면 날아감
  tick(dt) {
    const g = this.game; if (g.mode !== "island") return;
    const fast = g.me.moving && !g.sneak, t = performance.now() / 1000;
    for (const i of this.current()) {
      const sp = this.def.species[i.species]; if (!sp || !sp.flee) continue;
      const p = this.posOf(i, t), d = Math.hypot(p.x - g.me.x, p.y - g.me.y);
      if (d < 3 && fast) {
        const s = (this.near.get(i.id) || 0) + dt; this.near.set(i.id, s);
        if (s > 0.5) { this.flying.set(i.id, performance.now()); P.fleeInsect(i.id, this.slot).catch(() => {}); g.ui.toast(`${josa(g.data.items["insect_" + i.species]?.name || "곤충", "이", "가")} 날아가 버렸어요!\n살금살금 다가가 봐요`); }
      } else this.near.delete(i.id);
    }
  }

  addToList(list, g, TS, camX, camY, x0, y0, x1, y1) {
    const t = performance.now() / 1000;
    for (const i of this.current()) {
      if (i.x < x0 || i.x > x1 || i.y < y0 || i.y > y1) continue;
      const p = this.posOf(i, t);
      list.push({ y: p.y + 0.2, f: () => {
        g.fillStyle = "rgba(30,40,20,.22)"; g.beginPath(); g.ellipse(p.x * TS - camX, p.y * TS - camY + TS * 0.18, TS * 0.22, TS * 0.08, 0, 0, 7); g.fill();
        drawInsect(g, i.species, p.x * TS - camX, p.y * TS - camY - TS * 0.2, TS * 1.25, t, p.ph);
      } });
    }
    // 날아가는 모습(위로 사라짐)
    for (const [id, t0] of this.flying) {
      const i = this.list.find(x => x.id === id); const k = (performance.now() - t0) / 1000;
      if (!i || k > 1.2) { if (k > 1.2) continue; else continue; }
      list.push({ y: 999, f: () => { g.globalAlpha = 1 - k / 1.2; drawInsect(g, i.species, (i.x + 0.5 + k * 2) * TS - camX, (i.y + 0.5 - k * 4) * TS - camY, TS * 0.9, t, 0); g.globalAlpha = 1; } });
    }
    if (this.swing) {
      const k = (performance.now() - this.swing.t0) / 350;
      if (k > 1) this.swing = null;
      else list.push({ y: 999, f: () => drawNetSwing(g, this.swing.x * TS - camX, this.swing.y * TS - camY, TS, k) });
    }
  }

  // 행동 대상: 잠자리채가 있으면 1.5칸 안의 가장 가까운 곤충
  target() {
    if (!this.hasNet()) return null;
    const g = this.game, t = performance.now() / 1000;
    let best = null, bd = 1.5;
    for (const i of this.current()) { const p = this.posOf(i, t), d = Math.hypot(p.x - g.me.x, p.y - g.me.y); if (d < bd) { bd = d; best = i; } }
    return best ? { k: "bug", o: best, label: "잠자리채" } : null;
  }
  async catchIt(inst) {
    const g = this.game, t = performance.now() / 1000, p = this.posOf(inst, t);
    this.swing = { x: (p.x + g.me.x) / 2, y: (p.y + g.me.y) / 2 + 0.3, t0: performance.now() };
    if (insectSlot(serverNow()) !== this.slot) { g.ui.toast("새 곤충들이 나타났어요! 다시 찾아봐요"); return; }
    g.ui.busy(true);
    const r = await P.catchInsect(inst, this.slot, Date.now()).catch(() => ({ ok: false }));
    g.ui.busy(false);
    const it = g.data.items["insect_" + inst.species];
    if (!r.ok) { g.ui.toast(r.reason || "저장이 안 됐어요. 연결을 확인해 주세요"); return; }
    if (r.changed === false) return;
    g.ui.toast(`${it ? it.icon + " " + josa(it.name, "을", "를") : "곤충을"} 잡았어요!${r.first ? "\n곤충 도감에 새로 올랐어요 ✨" : ""}`);
  }

  // ---- 벌집: 오늘 고른 3그루를 흔들면 과일과 함께 떨어짐(가족 공유, 먼저 줍는 사람) ----
  // 오늘 벌집이 달린 나무인지(흔들 때 하루 단위 '흔들었음' 표시를 남길지 정함)
  isHoneyTree(id, round) { this.honeyDrops(round, -999, -999); return this.honey.some(h => h.tree.id === id); }
  honeyDrops(round, mx, my) {
    if (round !== this.honeyRound) {
      this.honeyRound = round;
      const ids = new Set(honeyTrees(this.trees.map(t => t.id), round, 3));
      this.honey = this.trees.filter(t => ids.has(t.id)).map(t => ({ tree: t, spot: honeySpot(this.game.world.map, t, this.game.fixed) })).filter(h => h.spot);
    }
    const out = [];
    for (const h of this.honey) {
      const t = h.tree; if (Math.abs(t.x - mx) > 5 || Math.abs(t.y - my) > 5) continue;
      if (!W.isTaken(t.zone, t.id)) continue;                      // 아직 안 흔듦
      const id = `${t.id}_h0`;
      if (W.isTaken(t.zone, id) || this.game.world.inHouse(h.spot.x, h.spot.y)) continue;
      out.push({ id, zone: t.zone || zoneOf(t.x, t.y), x: h.spot.x, y: h.spot.y, item: "honeycomb" });
    }
    return out;
  }
}
