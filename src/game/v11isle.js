// 버전 11 섬 발전: 숲섬(연못 고리)·다리·공사 표지판·놀이터 타기·전망대 보기·발전 게시판 그림
// 상태 적용은 applyState() 하나로(처음·값이 바뀔 때 몇 번 불러도 같은 결과) — 축하 연출은 따로(⑤ 반영)
import { state } from "../state.js";
import { applyPond, inOuter } from "../domain/isle.js";
import * as IS from "../services/isleStore.js";
import * as W from "../services/worldStore.js";
import { renderGround, SPR } from "./sprites.js";
import { renderMapBase } from "./minimap.js";
import { familyOf, nameOf } from "../config/gameConfig.js";

const IMG = {};
for (const n of ["bridge", "swing", "slide", "tower", "board", "seesaw", "sandbox", "well", "picnic", "signpost", "planter"]) { const i = new Image(); i.src = `art/isle/${n}.png`; IMG[n] = i; }
const ok = i => i && i.complete && i.naturalWidth > 0;
// 다리 전 숲섬을 덮는 나무(그림만, 건너갈 수 없으니 막지 않음)
const WILD = [[26, 25], [29, 24], [32, 26], [36, 26], [39, 27], [25, 29], [28, 30], [31, 28], [34, 31], [37, 30], [33, 23], [38, 24], [30, 31]];
// 놀이터 완성 뒤 꾸밈(막힌 칸)
const DECO = [{ n: "sandbox", x: 31, y: 31 }, { n: "picnic", x: 37, y: 31 }, { n: "well", x: 39, y: 26 }, { n: "planter", x: 25, y: 27 }];
const SIGNPOST = { x: 40, y: 28 };   // 다리 건너 숲섬 입구 팻말(다리 완성 뒤)
const SAFE = { x: 44.5, y: 27.5 };   // 숲섬에 잘못 들어가 있을 때 옮길 본섬 자리(다리 동쪽 끝)

export class IsleLayer {
  constructor(game) {
    this.game = game; this.cfg = game.data.isle;
    this.bridgeOn = false; this.solidCells = new Set(); this.built = new Set();
    this.ride = null; this.view = null; this.party = null;
    this.applyState();
    IS.startIsle(this.cfg);
    IS.onIsle(() => this.applyState());
  }
  // 확정된 공사 상태 전체를 지도·막힌 칸·바닥 그림에 반영
  applyState() {
    const g = this.game, w = g.world, b = IS.built();
    this.built = b;
    const bridge = b.has("bridge");
    if (bridge !== this.bridgeOn) {
      applyPond(w.tiles, w.w, this.cfg, bridge);
      this.bridgeOn = bridge;
      g.ground = renderGround(w); g.mapBase = renderMapBase(w); g._labels = null;
    }
    // 막힌 칸: 게시판·아직 안 끝난 공사 표지판·완성된 시설
    for (const k of this.solidCells) w.solidStatic[k] = 0;
    const cells = new Set(), add = (x, y) => cells.add(y * w.w + x);
    add(this.cfg.board.x, this.cfg.board.y);
    for (const p of this.cfg.projects) if (!b.has(p.id) && (p.id === "bridge" || bridge)) add(p.sign.x, p.sign.y);
    if (b.has("park")) { for (const r of this.cfg.rides) for (let i = 0; i < r.w; i++) for (let j = 0; j < r.h; j++) add(r.x + i, r.y + j); for (const d of DECO) add(d.x, d.y); }
    if (b.has("tower")) { const t = this.cfg.tower; for (let i = 0; i < t.w; i++) for (let j = 0; j < t.h; j++) add(t.x + i, t.y + j); }
    if (bridge) add(SIGNPOST.x, SIGNPOST.y);
    for (const k of cells) w.solidStatic[k] = 1;
    this.solidCells = cells;
    w.setHouses(w.houses);
    this.rescue();
  }
  // 갇히거나 막힌 칸 위에 서 있으면 본섬 안전한 자리로(다리 전 숲섬·고리 안, 새 시설 자리)
  rescue() {
    const g = this.game, m = g.me; if (!m || g.mode !== "island" || this.ride) return;
    const tx = Math.floor(m.x), ty = Math.floor(m.y);
    if (!this.bridgeOn && inOuter(this.cfg.pond, tx, ty)) { m.x = SAFE.x; m.y = SAFE.y; }
    else if (this.solidCells.has(ty * g.world.w + tx)) { m.y = ty + 1.5; if (!g.world.walkable(m.x, m.y)) { m.x = SAFE.x; m.y = SAFE.y; } }
    else return;
    g.sendPosNow().catch(() => {});
  }
  forestOpen() { return this.bridgeOn; }

  // ---------- 행동 ----------
  near(x, y, r = 1.6) { const m = this.game.me; return Math.hypot(x - m.x, y - m.y) < r; }
  target() {
    if (this.ride) return { k: "rideBusy", label: "신나요!" };
    const c = this.cfg;
    if (this.near(c.board.x + 0.5, c.board.y + 0.7)) return { k: "isle", label: "섬 키우기 🔨" };
    for (const p of c.projects) if (!this.built.has(p.id) && (p.id === "bridge" || this.bridgeOn) && this.near(p.sign.x + 0.5, p.sign.y + 0.7, 1.3))
      return { k: "isleSign", p, label: `${p.icon} 공사 안내` };
    if (this.built.has("park")) for (const r of c.rides) if (this.near(r.x + r.w / 2, r.y + r.h + 0.4, 1.4)) return { k: "ride", r, label: r.label };
    if (this.built.has("tower")) { const t = c.tower; if (this.near(t.x + t.w / 2, t.y + t.h + 0.4, 1.5)) return { k: "tower", label: "전망대 🔭" }; }
    return null;
  }
  act(t) {
    const ui = this.game.ui;
    if (t.k === "isle") return ui.openIsle();
    if (t.k === "isleSign") { ui.toast(`${t.p.icon} ${t.p.name} 공사 중이에요\n섬 발전 게시판에서 재료를 넣어 주세요`, 2600); return; }
    if (t.k === "ride") { this.ride = { r: t.r, t0: performance.now(), from: { x: this.game.me.x, y: this.game.me.y } }; return; }
    if (t.k === "tower") { this.view = { t0: performance.now() }; return; }
  }
  busy() { return !!(this.ride || this.view); }
  // 타는 동안 내 자리를 움직임(위치 보내기로 다른 폰에도 흔들리는 모습이 보임)
  tick() {
    const R = this.ride; if (!R) return;
    const m = this.game.me, r = R.r, t = (performance.now() - R.t0) / 1000, p = Math.min(1, t * 1000 / r.ms);
    if (p >= 1) { this.ride = null; m.x = r.x + r.w / 2; m.y = r.y + r.h + 0.6; m.dir = 0; this.game.sendPosNow().catch(() => {}); return; }
    m.dir = 0; m.moving = false;
    if (r.id === "swing") { m.x = r.x + 0.5; m.y = r.y + 0.75 + Math.sin(t * 5) * 0.28; }
    else if (r.id === "slide") { m.x = r.x + 0.2 + p * 1.6; m.y = r.y + 0.5 + (p < 0.5 ? -0.2 + p * 0.6 : 0.1 + (p - 0.5) * 0.4); m.dir = 2; }
    else { m.x = r.x + 0.25; m.y = r.y + 0.6 + Math.sin(t * 4) * 0.2; m.dir = 2; }
  }
  celebrate(p) { this.party = { p, t0: performance.now() }; }

  // ---------- 그리기 ----------
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1) {
    const c = this.cfg, draw = (img, x, y, w, h, over = 0, fb) => {
      const px = x * TS - camX, py = y * TS - camY;
      if (ok(img)) {
        const ih = w * TS * img.naturalHeight / img.naturalWidth, dh = Math.max(h * TS, Math.min(ih, (h + over) * TS));
        g.drawImage(img, px, py + h * TS - dh, w * TS, dh);
      } else if (fb) fb(px, py);
    };
    const vis = (x, y) => x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3;
    // 게시판 + 지금 공사 진행 막대
    if (vis(c.board.x, c.board.y)) list.push({ y: c.board.y + 0.95, f: () => {
      draw(IMG.board, c.board.x - 0.15, c.board.y, 1.3, 1, 0.5, (px, py) => { g.fillStyle = "#8a6240"; g.fillRect(px + TS * 0.1, py, TS * 0.8, TS * 0.7); g.fillStyle = "#f5e6c4"; g.fillRect(px + TS * 0.2, py + TS * 0.1, TS * 0.6, TS * 0.45); });
      this.drawBoardBar(g, c.board.x * TS - camX, c.board.y * TS - camY, TS);
    } });
    // 다리 전 숲섬 나무
    if (!this.bridgeOn) for (const [x, y] of WILD) if (vis(x, y)) list.push({ y: y + 0.95, f: () => g.drawImage(SPR.tree, x * TS - camX, y * TS - camY - TS * 0.5, TS, TS * 1.5) });
    // 다리(바닥 타일 위에 판자 그림)
    if (this.bridgeOn) { const a = c.bridge[0]; if (vis(a.x, a.y)) list.push({ y: a.y + 0.2, f: () => draw(IMG.bridge, a.x - 0.1, a.y - 0.15, c.bridge.length + 0.2, 1.3) }); }
    // 공사 표지판(아직 안 끝난 공사, 숲섬 안 것은 다리 뒤에만)
    for (const p of c.projects) if (!this.built.has(p.id) && (p.id === "bridge" || this.bridgeOn) && vis(p.sign.x, p.sign.y))
      list.push({ y: p.sign.y + 0.9, f: () => this.drawSign(g, p, p.sign.x * TS - camX, p.sign.y * TS - camY, TS, draw) });
    if (this.bridgeOn && vis(SIGNPOST.x, SIGNPOST.y)) list.push({ y: SIGNPOST.y + 0.9, f: () => draw(IMG.signpost, SIGNPOST.x, SIGNPOST.y, 1, 1, 0.3) });
    if (this.built.has("park")) {
      for (const r of c.rides) if (vis(r.x, r.y)) list.push({ y: r.y + r.h - 0.05, f: () => draw(IMG[r.id], r.x, r.y, r.w, r.h, r.id === "seesaw" ? 0 : 0.9, (px, py) => { g.fillStyle = "#c0392b"; g.fillRect(px, py, r.w * TS, r.h * TS); }) });
      for (const d of DECO) if (vis(d.x, d.y)) list.push({ y: d.y + 0.9, f: () => draw(IMG[d.n], d.x, d.y, 1, 1, 0.4) });
    }
    if (this.built.has("tower")) { const t = c.tower; if (vis(t.x, t.y)) list.push({ y: t.y + t.h - 0.05, f: () => draw(IMG.tower, t.x, t.y, t.w, t.h, 1.4, (px, py) => { g.fillStyle = "#8a6240"; g.fillRect(px, py - TS, t.w * TS, (t.h + 1) * TS); }) }); }
  }
  drawSign(g, p, px, py, TS, draw) {
    // 나무 더미(코드) + 팻말 그림 + 진행률
    g.fillStyle = "#9c7049"; g.fillRect(px + TS * 0.05, py + TS * 0.72, TS * 0.9, TS * 0.12); g.fillStyle = "#8a8a8a"; g.beginPath(); g.arc(px + TS * 0.8, py + TS * 0.7, TS * 0.13, 0, 7); g.fill();
    draw(IMG.signpost, p.sign.x, p.sign.y, 1, 1, 0.3, () => { g.fillStyle = "#8a6240"; g.fillRect(px + TS * 0.45, py, TS * 0.1, TS * 0.8); g.fillRect(px + TS * 0.1, py, TS * 0.8, TS * 0.35); });
    const cur = this.game.ui && IS.isleReady() ? this.pctOf(p) : null;
    g.font = `${Math.round(TS * 0.36)}px Jua, sans-serif`; g.textAlign = "center";
    const label = `${p.icon} ${cur === null ? "" : cur + "%"}`;
    const tw = g.measureText(label).width + 10;
    g.fillStyle = "rgba(255,253,246,.92)"; g.beginPath(); g.roundRect(px + TS / 2 - tw / 2, py - TS * 0.75, tw, TS * 0.42, 8); g.fill();
    g.fillStyle = "#5a3f27"; g.fillText(label, px + TS / 2, py - TS * 0.44);
  }
  pctOf(p) {
    const gives = IS.isleGives(), need = p.need; let got = 0, all = 0;
    for (const [k, n] of Object.entries(need)) { all += n; let s = 0; for (const row of Object.values((gives && gives[p.id]) || {})) if (row && Number.isSafeInteger(row[k])) s += row[k]; got += Math.min(n, s); }
    return all ? Math.floor(got * 100 / all) : 100;
  }
  drawBoardBar(g, px, py, TS) {
    const cur = this.cfg.projects.find(p => !this.built.has(p.id));
    const label = cur ? `${cur.icon} ${this.pctOf(cur)}%` : "🎉";
    g.font = `${Math.round(TS * 0.34)}px Jua, sans-serif`; g.textAlign = "center";
    const tw = g.measureText(label).width + 10, glow = cur && Object.keys(cur.need).some(k => ((state.player && state.player.inv) || {})[k] > 0) && (performance.now() / 500 | 0) % 2;
    g.fillStyle = glow ? "rgba(255,236,150,.95)" : "rgba(255,253,246,.92)"; g.beginPath(); g.roundRect(px + TS / 2 - tw / 2, py - TS * 0.95, tw, TS * 0.42, 8); g.fill();
    g.fillStyle = "#5a3f27"; g.fillText(label, px + TS / 2, py - TS * 0.65);
  }
  // 전망대 보기·축하는 화면 맨 위에
  drawOverlay(g) {
    const G = this.game, W0 = G.W, H0 = G.H;
    if (this.view) {
      const w = G.world, s = Math.min((W0 - 24) / w.w, (H0 - 96) / w.h), ox = (W0 - w.w * s) / 2, oy = 58 + (H0 - 96 - w.h * s) / 2;   // 위 버튼 줄을 피해서
      g.fillStyle = "rgba(20,40,60,.88)"; g.fillRect(0, 0, W0, H0);
      g.imageSmoothingEnabled = true; g.drawImage(G.ground, 0, 0, G.ground.width, G.ground.height, ox, oy, w.w * s, w.h * s); g.imageSmoothingEnabled = false;
      for (const h of w.houses) { g.fillStyle = familyOf(h.mid).color; g.fillRect(ox + h.x * s, oy + h.y * s, h.w * s, h.h * s); }
      const people = [{ m: state.mid, x: G.me.x, y: G.me.y }, ...[...W.othersHere().values()].map(o => ({ m: o.m, x: o.x, y: o.y }))];
      g.font = "15px Jua, sans-serif"; g.textAlign = "center";
      for (const p of people) {
        const x = ox + p.x * s, y = oy + p.y * s;
        g.fillStyle = familyOf(p.m).color; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
        const n = nameOf(p.m) + (p.m === state.mid ? "(나)" : ""), tw = g.measureText(n).width + 10;
        g.fillStyle = "rgba(255,253,246,.95)"; g.beginPath(); g.roundRect(x - tw / 2, y - 30, tw, 20, 8); g.fill();
        g.fillStyle = familyOf(p.m).color; g.fillText(n, x, y - 15);
      }
      g.fillStyle = "#fff"; g.font = "18px Jua, sans-serif"; g.fillText("🔭 전망대에서 본 우리 섬 — 화면을 누르면 내려가요", W0 / 2, H0 - 12);
      if (performance.now() - this.view.t0 > 60000) this.view = null;
    }
    if (this.party) {
      const t = (performance.now() - this.party.t0) / 1000;
      if (t > 4) { this.party = null; return; }
      g.save(); g.globalAlpha = Math.min(1, (4 - t) * 2);
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4, r = (t * 160 + i * 9) % (Math.max(W0, H0) * 0.6);
        g.fillStyle = ["#f0b43c", "#e8574f", "#7ab857", "#4fb3ff", "#c86fd1"][i % 5];
        g.fillRect(W0 / 2 + Math.cos(a) * r, H0 / 2 + Math.sin(a) * r - 40, 7, 7);
      }
      g.font = "34px Jua, sans-serif"; g.textAlign = "center"; const txt = `🎉 ${this.party.p.name} 완성! 🎉`, tw = g.measureText(txt).width + 30;
      g.fillStyle = "rgba(255,253,246,.95)"; g.beginPath(); g.roundRect(W0 / 2 - tw / 2, H0 / 2 - 70, tw, 56, 16); g.fill();
      g.fillStyle = "#5a3f27"; g.fillText(txt, W0 / 2, H0 / 2 - 30);
      g.restore();
    }
  }
}
