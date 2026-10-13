// 버전 7 목장: 텃밭·닭·씨앗 상자·동물 친구 집·애완동물(따라다니기·쓰다듬기)
import { state } from "../state.js";
import { nameOf, josa } from "../config/gameConfig.js";
import { serverNow, isConnected } from "../services/fb.js";
import * as W from "../services/worldStore.js";
import * as FS from "../services/farmStore.js";
import { sendEmote } from "../services/emoteStore.js";
import { growth, waterSlot, seedOfDay, eggSupply, fedToday, feedZone, seedboxZone, shearZone, shearId } from "../domain/farm.js";
import { drawCoop, drawHen, drawNest, drawEgg, drawTrough, drawSeedbox, drawPetHouse, drawSoil, drawCrop, drawDrops, drawPet, drawHearts, drawPen, drawSheep } from "./ranchArt.js";

const DIRV = [[0, 1], [-1, 0], [1, 0], [0, -1]];

export class RanchLayer {
  constructor(game) {
    this.game = game;
    this.cfg = game.data.farm;
    const w = game.world, c = this.cfg;
    // 막힌 칸: 닭장·씨앗 상자·동물 친구 집·모이통 (지도 고정)
    const block = (x, y) => { w.solidStatic[y * w.w + x] = 1; };
    for (const q of [c.coop, c.petHouse]) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) block(x, y);
    block(c.seedbox.x, c.seedbox.y); block(c.trough.x, c.trough.y);
    w.setHouses(w.houses);
    this.plotAt = new Map(c.plots.map(p => [p.x + "," + p.y, p]));
    this.hearts = [];            // {x, y, until} 화면 하트(닭·애완동물)
    this.pets = new Map();       // mid → {x, y, left, hop, place}
    this.feedFlash = 0;
    FS.startFarm(c);
    FS.onFarm(e => { if (e && e.got) { const it = game.data.items[e.got.item]; game.ui.toast(`${it.icon} ${it.name} ×${e.got.qty} 가방에 들어왔어요!\n(텃밭에서 거둔 채소)`, 2600); } });
  }

  near(x, y, r = 1.3) { const m = this.game.me; return Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y) < r; }
  inRanch() { const r = this.game.world.map.ranch, m = this.game.me; return this.game.mode === "island" && r && m.x > r.x - 2 && m.x < r.x + r.w + 2 && m.y > r.y - 2 && m.y < r.y + r.h + 2; }
  fed() { return fedToday(W.isTaken, this.cfg); }
  eggs() { return this.inRanch() ? eggSupply(this.cfg, this.fed()) : []; }

  // ---------- 행동 버튼 ----------
  target() {
    if (!this.inRanch()) return null;
    const c = this.cfg, g = this.game, now = serverNow();
    if (this.near(c.seedbox.x, c.seedbox.y, 1.5)) return { k: "r_seedbox", label: W.isTaken(seedboxZone(c), "seedbox_" + state.mid) ? "씨앗은 내일 또 ✓" : "씨앗 받기 🌱" };
    if (this.near(c.trough.x, c.trough.y, 1.5)) return { k: "r_feed", label: W.isTaken(feedZone(c), "feed_" + state.mid) ? "오늘 모이 줬어요 ✓" : "모이 주기 🐔" };
    const ph = c.petHouse; if (this.near(ph.x + ph.w / 2 - 0.5, ph.y + ph.h - 0.5, 1.8)) return { k: "r_pethouse", label: "동물 친구 집" };
    // v8 양: 가까운 양 — 오늘 안 깎았으면 털 깎기, 깎았으면 쓰다듬기
    if (c.sheepPen) {
      const t = performance.now() / 1000; let sb = null, sd = 1.4;
      (c.sheep || []).forEach((id, i) => { const p = this.sheepPos(i, t), d = Math.hypot(p.x - g.me.x, p.y - g.me.y); if (d < sd) { sd = d; sb = id; } });
      if (sb) return this.shorn(sb) ? { k: "r_sheeppat", sheep: sb, label: "쓰다듬기 🐑" } : { k: "r_shear", sheep: sb, label: "털 깎기 ✂️" };
    }
    // 가장 가까운 텃밭 칸(앞칸 우선)
    let best = null, bd = 1.25;
    const f = g.front();
    for (const p of c.plots) {
      const d = (p.x === f.x && p.y === f.y) ? 0 : Math.hypot(p.x + 0.5 - g.me.x, p.y + 0.5 - g.me.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return null;
    if (!FS.ready()) return { k: "r_wait", label: "텃밭 불러오는 중" };
    const v = FS.plots()[best.id];
    if (!v) return { k: "r_plant", plot: best, label: "심기 🌱" };
    const gr = growth(v, c, now);
    if (gr && gr.stage === 3) return { k: "r_harvest", plot: best, label: v.by === state.mid ? "거두기 🧺" : `거두기 🧺(${nameOf(v.by)})` };
    const w = waterSlot(v, c, state.mid, now);
    if (w.ok) return { k: "r_water", plot: best, label: "물 주기 💧" };
    return { k: "r_info", plot: best, label: gr ? `${Math.ceil(gr.left / 60000)}분 뒤 다 자라요` : "텃밭" };
  }
  // 애완동물 쓰다듬기: 행동 버튼 우선순위가 가장 낮음(내 동물은 늘 옆에 있으므로)
  petTarget() {
    const g = this.game; let best = null, bd = 1.2;
    for (const [mid, p] of this.pets) {
      if (p.place !== this.place()) continue;
      const d = Math.hypot(p.x - g.me.x, p.y - g.me.y);
      if (d < bd && this.petOf(mid)) { bd = d; best = { k: "r_pat", mid, label: "쓰다듬기 🐾" }; }
    }
    return best;
  }

  async act(t) {
    const g = this.game, ui = g.ui, c = this.cfg;
    if (t.k === "r_pethouse") return ui.openPet();
    if (t.k === "r_pat") return this.pat(t.mid);
    if (t.k === "r_sheeppat") { this.hearts.push({ sheep: t.sheep, until: performance.now() + 1600 }); ui.toast("🐑 메에~ 양이 좋아해요! 털은 내일 다시 자라요", 1800); return; }
    if (t.k === "r_wait" || t.k === "r_info") { if (t.k === "r_info") this.infoToast(t.plot); return; }
    if (!isConnected()) { ui.toast("인터넷 연결을 기다리는 중이에요"); return; }
    if (t.k === "r_plant") return ui.openPlant(t.plot);
    if (t.k === "r_shear") {
      g.busy = true;
      try {
        const ok = await g.gain(shearZone(c), shearId(c, t.sheep, state.mid), "wool", c.woolQty, "털이 다시 자라는 중이에요. 내일 또 깎아요");
        if (ok) { this.hearts.push({ sheep: t.sheep, until: performance.now() + 1600 }); ui.toast(`✂️ 싹둑싹둑! 양털 ×${c.woolQty} 가방에 넣었어요
작업대에서 양털 2개 → 실을 만들어요`, 2600); }
      } finally { g.busy = false; }
      return;
    }
    if (t.k === "r_seedbox") {
      const seed = seedOfDay(W.today(), state.mid, c);
      g.busy = true; try { await g.gain(seedboxZone(c), "seedbox_" + state.mid, seed, c.seedboxQty, "오늘 씨앗은 벌써 받았어요. 내일 또 와요"); } finally { g.busy = false; }
      return;
    }
    if (t.k === "r_feed") {
      g.busy = true;
      try {
        const ok = await g.gain(feedZone(c), "feed_" + state.mid, "feed", 0, "오늘은 벌써 모이를 줬어요. 내일 또 줘요");
        if (ok) { this.feedFlash = performance.now() + 3000; for (let i = 0; i < 3; i++) this.hearts.push({ hen: i, until: performance.now() + 1800 }); sendEmote("heart").catch(() => {}); ui.toast("🐔 꼬꼬댁! 닭들이 신났어요\n오늘은 30분마다 둥지에 달걀이 생겨요", 2600); }
      } finally { g.busy = false; }
      return;
    }
    if (t.k === "r_water") {
      g.busy = true; ui.busy(true);
      try {
        const r = await FS.water(t.plot.id, serverNow());
        if (r.ok) ui.toast(r.slot === "w1" ? "💧 물을 줬어요! 수확이 1개 늘어요\n다른 가족이 한 번 더 주면 또 1개!" : "💧💧 가족이 함께 물을 줬어요! 수확 +2", 2400);
        else ui.toast(r.reason);
      } finally { ui.busy(false); g.busy = false; }
      return;
    }
    if (t.k === "r_harvest") {
      g.busy = true; ui.busy(true);
      try {
        const r = await FS.harvest(t.plot.id);
        if (!r.ok) { ui.toast(r.reason); return; }
        const it = g.data.items[r.rec.item];
        if (r.rec.owner !== state.mid) ui.toast(`${it.icon} ${it.name} ×${r.rec.qty}를 거뒀어요\n${josa(nameOf(r.rec.owner), "이", "가")} 심은 거라 ${nameOf(r.rec.owner)} 가방으로 보냈어요 💌`, 2800);
      } finally { ui.busy(false); g.busy = false; }
    }
  }
  infoToast(p) {
    const v = FS.plots()[p.id]; if (!v) return;
    const gr = growth(v, this.cfg, serverNow()), it = this.game.data.items[gr.item];
    const who = v.by === state.mid ? "내가" : josa(nameOf(v.by), "이", "가");
    this.game.ui.toast(`${it.icon} ${who} 심은 ${it.name} · ${Math.ceil(gr.left / 60000)}분 뒤 다 자라요\n물 ${gr.waters}번 → 수확 ${gr.qty}개`, 2400);
  }
  async plant(plot, crop) {
    const ui = this.game.ui;
    ui.busy(true);
    try {
      const r = await FS.plant(plot.id, crop);
      if (r.ok) { const it = this.game.data.items[this.cfg.crops[crop].item]; ui.toast(`🌱 ${it.name}를 심었어요! ${this.cfg.crops[crop].ms / 60000}분 뒤에 다 자라요\n물을 주면 더 많이 거둬요`, 2600); }
      else ui.toast(r.reason || "심지 못했어요");
    } finally { ui.busy(false); }
  }
  pat(mid) {
    const p = this.pets.get(mid); if (!p) return;
    p.hop = 1; this.hearts.push({ pet: mid, until: performance.now() + 1600 });
    sendEmote("heart").catch(() => {});
    const pet = this.petOf(mid);
    if (pet) this.game.ui.toast(`🐾 ${pet.name}${mid === state.mid ? "" : `(${nameOf(mid)}네)`}가 좋아해요!`, 1500);
  }

  // ---------- 양(v8) ----------
  shorn(sheepId) { return W.isTaken(shearZone(this.cfg), shearId(this.cfg, sheepId, state.mid)); }
  // 우리 안을 천천히 거님(시간으로 정해짐). 칸 좌표(가운데)
  sheepPos(i, t) {
    const P = this.cfg.sheepPen, ph = t * 0.11 + i * 3.3;
    return { x: P.x + 1 + (P.w - 2) * (0.5 + 0.45 * Math.sin(ph + i)), y: P.y + 1.2 + (P.h - 2.2) * (0.5 + 0.45 * Math.sin(ph * 0.7 + i * 2.1)), flip: Math.cos(ph + i) < 0, munch: Math.sin(ph * 4) > 0.6 };
  }

  // ---------- 애완동물 따라다니기 ----------
  petOf(mid) { const m = state.members[mid]; const p = m && m.pet; return p && this.cfg.pets.includes(p.kind) ? p : null; }
  place() { return this.game.mode === "island" ? "island" : "house_" + this.game.houseMid; }
  // people: [{mid, x, y, dir, boat}] — 지금 화면에 있는 사람(나 포함)
  tick(dt, people) {
    const place = this.place(), seen = new Set();
    for (const h of this.hearts) if (h.until < performance.now()) h.dead = true;
    this.hearts = this.hearts.filter(h => !h.dead);
    for (const o of people) {
      if (!this.petOf(o.mid)) continue;
      seen.add(o.mid);
      let p = this.pets.get(o.mid);
      const [dx, dy] = DIRV[o.dir || 0];
      const tx = o.x - dx * 0.85 + (dy ? 0.35 : 0), ty = o.y - dy * 0.75 + 0.15;
      if (!p || p.place !== place || Math.hypot(tx - p.x, ty - p.y) > 7) { p = { x: tx, y: ty, left: false, hop: 0, place, moving: false }; this.pets.set(o.mid, p); }
      if (o.boat) { p.moving = false; }                       // 배 탈 땐 나루터에서 기다림
      else {
        const ex = tx - p.x, ey = ty - p.y, d = Math.hypot(ex, ey);
        p.moving = d > 0.12;
        if (d > 0.05) { const k = Math.min(1, dt * (d > 1.5 ? 7 : 4)); p.x += ex * k; p.y += ey * k; }
        if (Math.abs(ex) > 0.05) p.left = ex < 0;
      }
      p.hop = Math.max(0, p.hop - dt * 2.5);
    }
    for (const k of [...this.pets.keys()]) if (!seen.has(k)) this.pets.delete(k);
  }
  // ox, oy = 화면 원점(섬: -camX, -camY / 집: 방 원점)
  addPets(list, g, TS, ox, oy, t) {
    for (const [mid, p] of this.pets) {
      const pet = this.petOf(mid); if (!pet) continue;
      list.push({ y: p.y - 0.05, f: () => {
        const sx = ox + p.x * TS, sy = oy + p.y * TS;
        drawPet(g, pet.kind, sx, sy, TS * 1.7, p.left, t, p.moving, p.hop);
        g.font = `${Math.round(TS * 0.26)}px Jua, sans-serif`; g.textAlign = "center";
        const tw = g.measureText(pet.name).width + 8;
        g.fillStyle = "rgba(255,253,246,.85)"; g.beginPath(); g.roundRect(sx - tw / 2, sy + TS * 0.06, tw, TS * 0.3, 6); g.fill();
        g.fillStyle = "#6b4a2e"; g.fillText(pet.name, sx, sy + TS * 0.28);
        const h = this.hearts.find(q => q.pet === mid); if (h) drawHearts(g, sx, sy - TS * 0.45, TS, 1 - (h.until - performance.now()) / 1600);
      } });
    }
  }

  // ---------- 그리기(섬) ----------
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1, t) {
    const r = this.game.world.map.ranch; if (!r || r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) return;
    const c = this.cfg, now = serverNow(), P = FS.plots(), sx = x => x * TS - camX, sy = y => y * TS - camY;
    const mine = this.game.mode === "island", front = this.game.front();
    // 텃밭
    for (const p of c.plots) {
      const v = P[p.id], gr = v ? growth(v, c, now) : null;
      list.push({ y: p.y + 0.6, f: () => {
        drawSoil(g, sx(p.x), sy(p.y), TS, gr && gr.waters > 0);
        if (gr) { drawCrop(g, sx(p.x), sy(p.y), TS, v.crop, gr.stage, t); if (gr.waters) drawDrops(g, sx(p.x), sy(p.y), TS, gr.waters); }
        if (gr && mine && this.near(p.x, p.y, 2.2) && !(front.x === p.x && front.y === p.y)) {        // 가까이 가면 남은 시간(바로 앞 칸은 행동 버튼에 나옴)
          const txt = gr.stage === 3 ? "다 자랐어요!" : `${Math.ceil(gr.left / 60000)}분`;
          g.font = `${Math.round(TS * 0.26)}px Jua, sans-serif`; g.textAlign = "center";
          const tw = g.measureText(txt).width + 8; g.fillStyle = gr.stage === 3 ? "rgba(255,211,92,.95)" : "rgba(255,253,246,.9)";
          g.beginPath(); g.roundRect(sx(p.x) + TS / 2 - tw / 2, sy(p.y) - TS * 0.32, tw, TS * 0.3, 6); g.fill();
          g.fillStyle = "#4f2f19"; g.fillText(txt, sx(p.x) + TS / 2, sy(p.y) - TS * 0.1);
        }
      } });
    }
    // 닭장·둥지·모이통·씨앗 상자·동물 친구 집
    list.push({ y: c.coop.y + c.coop.h, f: () => drawCoop(g, sx(c.coop.x), sy(c.coop.y), c.coop.w * TS, c.coop.h * TS, TS) });
    for (const n of c.nests) list.push({ y: n.y + 0.2, f: () => drawNest(g, sx(n.x) + TS / 2, sy(n.y) + TS * 0.65, TS) });
    const fed = this.fed();
    list.push({ y: c.trough.y + 0.9, f: () => drawTrough(g, sx(c.trough.x), sy(c.trough.y), TS, fed) });
    list.push({ y: c.seedbox.y + 0.9, f: () => drawSeedbox(g, sx(c.seedbox.x), sy(c.seedbox.y), TS, !W.isTaken(seedboxZone(c), "seedbox_" + state.mid)) });
    list.push({ y: c.petHouse.y + c.petHouse.h, f: () => drawPetHouse(g, sx(c.petHouse.x), sy(c.petHouse.y), c.petHouse.w * TS, c.petHouse.h * TS, TS) });
    // v8 양 우리 + 양 2마리
    if (c.sheepPen) {
      const P = c.sheepPen;
      list.push({ y: P.y - 0.1, f: () => drawPen(g, sx(P.x), sy(P.y), P.w * TS, P.h * TS, TS) });
      (c.sheep || []).forEach((id, i) => {
        const p = this.sheepPos(i, t), cut = this.shorn(id);
        list.push({ y: p.y, f: () => {
          drawSheep(g, sx(p.x), sy(p.y), TS * 1.25, p.flip, t + i, cut, p.munch);
          const h = this.hearts.find(q => q.sheep === id); if (h) drawHearts(g, sx(p.x), sy(p.y) - TS * 0.6, TS, 1 - (h.until - performance.now()) / 1600);
        } });
      });
    }
    // 닭 3마리: 시간으로 정해지는 걸음(모든 폰이 비슷하게)
    const A = c.henArea, flash = performance.now() < this.feedFlash;
    for (let i = 0; i < 3; i++) {
      const ph = t * 0.23 + i * 2.1;
      let hx = A.x + 0.5 + (A.w - 1) * (0.5 + 0.45 * Math.sin(ph * 0.9 + i)), hy = A.y + 0.5 + (A.h - 1) * (0.5 + 0.45 * Math.sin(ph * 0.63 + i * 1.7));
      if (flash) { hx = c.trough.x + 0.5 + (i - 1) * 0.8; hy = c.trough.y + 1.2; }
      const flip = Math.cos(ph * 0.9 + i) < 0, peck = flash || Math.sin(ph * 3) > 0.7;
      list.push({ y: hy, f: () => {
        drawHen(g, sx(hx), sy(hy), TS * 1.1, flash ? i === 2 : flip, t + i, peck);
        const h = this.hearts.find(q => q.hen === i); if (h) drawHearts(g, sx(hx), sy(hy) - TS * 0.5, TS, 1 - (h.until - performance.now()) / 1800);
      } });
    }
  }
  drawEggItem(g, x, y, TS) { drawEgg(g, x + TS / 2, y + TS * 0.7, TS); }
}
