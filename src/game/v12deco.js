// 버전 12 꾸미기: 방 벽지·바닥, 러그·벽걸이·탁자 위 소품, 색칠·전시 그림, 밤 조명 / 섬 마당(물건·길·꽃)과 꽃 섞어 심기
import { state, onState } from "../state.js";
import { serverNow } from "../services/fb.js";
import * as W from "../services/worldStore.js";
import * as P from "../services/playerStore.js";
import * as D from "../services/decorStore.js";
import { furnArt, furnRawImg } from "./furnArt.js";
import { SPR } from "./sprites.js";
import { layerOf } from "../domain/placement.js";
import { roomStyleOf } from "../domain/decor.js";
import { validYard, hiddenYard, yardCellOk, placeYard, canPlaceYard, OFF, BAND } from "../domain/yard.js";
import { blooms, BLOOM_ZONE } from "../domain/bloom.js";
import { inOuter } from "../domain/isle.js";
import { T } from "./world.js";

const MIDS = ["m0", "m1", "m2", "m3", "m4", "m5"];
const WALK = new Set([T.SAND, T.GRASS, T.PATH, T.BRIDGE]);
const key = (x, y) => x + "," + y;
const FLOWER = { red: "#e8574f", yellow: "#f5c84a", white: "#f7f4ec", pink: "#f49ac1", orange: "#f2924a", purple: "#a77bd6", blue: "#6aa7e8", gold: "#f2c230" };

// 아이템 그림(art/icon) — 캔버스용, 없으면 null
const ICON = new Map();
function iconImg(id) {
  if (!ICON.has(id)) { const i = new Image(); i.src = `art/icon/${id}.png`; ICON.set(id, i); }
  const i = ICON.get(id); return i.complete && i.naturalWidth ? i : null;
}
// 색칠: 원래 그림 위에 색을 덧칠(가구 모양 안쪽만)
const TINTC = new Map();
function tinted(fc, color, ck) {
  if (TINTC.has(ck)) return TINTC.get(ck);
  const c = document.createElement("canvas"); c.width = fc.width; c.height = fc.height; c.over = fc.over;
  const g = c.getContext("2d"); g.drawImage(fc, 0, 0);
  g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.42; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  if (TINTC.size > 200) TINTC.clear();
  TINTC.set(ck, c); return c;
}

export class DecoLayer {
  constructor(game) {
    this.game = game; this.d = game.data;
    this.valid = {}; this.solid = new Set(); this.solidOthers = new Set(); this.blooms = []; this.bloomRound = null;
    this.reserved = this.buildReserved();
    const w = game.world;
    w.extraSolidFn = houses => this.recompute(houses);
    D.startDecor();
    D.onDecor(() => this.refresh());
    this.bloomUnsub = null; this.bloomTaken = {};
    onState(w => { if (w === "player") this.refresh(); });   // 내 마당이 바뀌어도 다시 계산
    setInterval(() => this.updateBlooms(), 30000);              // 05시 회차가 바뀌면 새 꽃
    this.refresh();
  }
  // 마당에 못 쓰는 칸: 채집밭·버섯·약초 후보·목장·나루터·숲섬·게시판 둘레·나무 둘레(열매·벌집 떨어지는 칸)
  buildReserved() {
    const s = new Set(), add = (x, y) => s.add(key(x, y)), d = this.d, w = this.game.world;
    for (const f of d.gatheringFields.fields) { if (f.rect) for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++) for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) add(x, y); for (const c of f.cells || []) add(c.x, c.y); }
    for (const c of d.forage.candidates || []) add(c.x, c.y);
    for (let y = 58; y < 74; y++) for (let x = 88; x < 110; x++) add(x, y);   // 목장(버전 5 자리)
    for (const dk of w.map.docks || []) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(dk.x + dx, dk.y + dy);
    if (d.isle && d.isle.pond) for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (inOuter(d.isle.pond, x, y)) add(x, y);
    if (d.board) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(d.board.x + dx, d.board.y + dy);
    for (const o of w.objects) if (o.k === "tree") for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(o.x + dx, o.y + dy);
    return s;
  }
  ctx(houses) {
    const w = this.game.world;
    return { houses: houses || w.houses, reserved: this.reserved,
      walkTile: (x, y) => WALK.has(w.tile(x, y)),
      staticBlocked: (x, y) => !!w.solidStatic[y * w.w + x] || w.objAt.has(key(x, y)) };
  }
  // 집 위치·가족 데이터가 바뀔 때: 보이는 마당 목록과 막힌 칸(world.setHouses가 부름)
  recompute(houses) {
    const c = this.ctx(houses), solid = new Set(), valid = {}, others = new Set();
    for (const m of MIDS) {
      const p = D.playerOf(m); if (!p) continue;
      valid[m] = validYard(this.d.furniture, p, m, c);
      for (const v of valid[m]) if (v.solid) for (const [x, y] of v.cells) { solid.add(key(x, y)); if (m !== state.mid) others.add(key(x, y)); }
    }
    this.valid = valid; this.solid = solid; this.solidOthers = others;
    // ⑦ 집이 옮겨져 마당이 따라가도 바로: 갇힘 구출·꽃 자리(setHouses 다음에, 다시 부르지 않게)
    if (!this._post) { this._post = true; queueMicrotask(() => { this._post = false; this.rescue(); this.updateBlooms(); }); }
    return [...solid].map(k => { const [x, y] = k.split(",").map(Number); return y * this.game.world.w + x; });
  }
  refresh() {
    const g = this.game, w = g.world;
    w.setHouses(w.houses);           // recompute + 막힌 칸 다시
    this.rescue();
    this.updateBlooms();
    if (g.deco && g.deco.yard) g.ui.decoRefresh();
    g.ui.v12Refresh && g.ui.v12Refresh();
  }
  // 내가 마당 물건 칸에 갇혀 있으면 우리 집 문 앞으로
  rescue() {
    const g = this.game, m = g.me; if (!m || g.mode !== "island") return;
    if (!this.solid.has(key(Math.floor(m.x), Math.floor(m.y)))) return;
    const h = g.world.houseOf(state.mid) || g.world.houses[0];
    m.x = h.door.x + 0.5; m.y = h.door.y + 1.5; g.sendPosNow && g.sendPosNow().catch(() => {});
  }

  // ---------- 꽃 섞어 심기 ----------
  updateBlooms() {
    const round = W.today();
    if (round !== this.bloomRound) {
      this.bloomRound = round;
      if (this.bloomUnsub) this.bloomUnsub();
      this.bloomUnsub = W.watchZone ? W.watchZone(round, BLOOM_ZONE, v => { this.bloomTaken = v; }) : null;
    }
    const out = [];
    for (const m of MIDS) {
      const plants = (this.valid[m] || []).filter(v => this.d.furniture[v.f.type] && this.d.furniture[v.f.type].flower);
      for (const b of blooms(round, m, plants, this.d.furniture, this.d.bloom)) out.push({ ...b, owner: m });
    }
    this.blooms = out;
  }
  // 오늘 실제로 딴 내 새 꽃 수(꽃을 넣었다 놓아 목록이 바뀌어도 하루 최대 넘지 않게, ⑦)
  pickedToday() { return Object.values(this.bloomTaken || {}).filter(c => c && c.by === state.mid).length; }
  bloomTarget() {
    if (this.pickedToday() >= this.d.bloom.maxPerDay) return null;
    const m = this.game.me; let best = null, bd = 1.3;
    for (const b of this.blooms) {
      if (b.owner !== state.mid || this.bloomTaken[b.pid]) continue;
      const d = Math.hypot(b.x + 0.5 - m.x, b.y + 0.5 - m.y); if (d < bd) { bd = d; best = b; }
    }
    return best ? { k: "bloom", b: best, label: "새 꽃 따기 🌸" } : null;
  }
  async pickBloom(b) {
    if (this.bloomRound !== W.today()) { this.updateBlooms(); return; }
    if (this.pickedToday() >= this.d.bloom.maxPerDay) { this.game.ui.toast("오늘 새 꽃은 다 땄어요. 내일 또 봐요"); return; }
    await this.game.gain(BLOOM_ZONE, b.pid, b.item, 1, "오늘 이 꽃은 벌써 땄어요");
  }

  // ---------- 섬 그리기 ----------
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1, t) {
    const defs = this.d.furniture;
    for (const m of MIDS) for (const v of this.valid[m] || []) {
      const [cx, cy] = v.cells[0]; if (cx > x1 || cy > y1 || cx + 4 < x0 || cy + 4 < y0) continue;
      const d = defs[v.f.type], [w, h] = (v.f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      const xs = Math.min(...v.cells.map(c => c[0])), ys = Math.min(...v.cells.map(c => c[1]));
      const sx = xs * TS - camX, sy = ys * TS - camY;
      if (v.layer === "path") { list.push({ y: -1e6 + ys, f: () => this.drawFlat(g, v.f, sx, sy, w * TS, h * TS) }); continue; }
      if (d.flower) { list.push({ y: ys + 0.6, f: () => this.drawPlant(g, d.flower, sx, sy, TS, t) }); continue; }
      list.push({ y: ys + h, f: () => this.drawFurn(g, v.f, w, h, sx, sy, TS) });
    }
    for (const b of this.blooms) {
      if (this.bloomTaken[b.pid]) continue;
      const sx = b.x * TS - camX, sy = b.y * TS - camY;
      list.push({ y: b.y + 0.7, f: () => {
        this.drawPlant(g, b.item.slice(7), sx + TS * 0.1, sy - TS * 0.15, TS * 0.8, t);
        g.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 5) * 0.4})`; g.font = `${Math.round(TS * 0.4)}px sans-serif`; g.textAlign = "center"; g.fillText("✨", sx + TS * 0.8, sy);
      } });
    }
    // 마당 꾸미기 중: 쓸 수 있는 칸 표시
    const dc = this.game.deco;
    if (dc && dc.yard) {
      const c = this.ctx(), hs = this.game.world.houseOf(state.mid);
      list.push({ y: -1e6 + 1e5, f: () => {
        g.lineWidth = 1;
        for (let y = hs.y - BAND; y < hs.y + hs.h + BAND; y++) for (let x = hs.x - BAND; x < hs.x + hs.w + BAND; x++) {
          if (!yardCellOk(c, state.mid, x, y)) continue;
          g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(x * TS - camX, y * TS - camY, TS, TS);
          g.strokeStyle = "rgba(255,255,255,.5)"; g.strokeRect(x * TS - camX + .5, y * TS - camY + .5, TS - 1, TS - 1);
        }
      } });
    }
  }
  drawPlant(g, color, sx, sy, TS, t) {
    const c = FLOWER[color] || FLOWER.red, sway = Math.sin(t * 2 + sx) * TS * 0.02;
    g.strokeStyle = "#3f8f3a"; g.lineWidth = Math.max(2, TS * 0.06);
    for (const [dx, h] of [[0.3, 0.45], [0.5, 0.6], [0.7, 0.42]]) { g.beginPath(); g.moveTo(sx + TS * dx, sy + TS * 0.95); g.lineTo(sx + TS * dx + sway, sy + TS * (0.95 - h)); g.stroke(); }
    g.fillStyle = "#5fb35a"; g.beginPath(); g.ellipse(sx + TS * 0.5, sy + TS * 0.88, TS * 0.32, TS * 0.1, 0, 0, 7); g.fill();
    for (const [dx, h] of [[0.3, 0.45], [0.5, 0.6], [0.7, 0.42]]) {
      const fx = sx + TS * dx + sway, fy = sy + TS * (0.95 - h);
      g.fillStyle = c; for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.beginPath(); g.arc(fx + Math.cos(a) * TS * 0.07, fy + Math.sin(a) * TS * 0.07, TS * 0.065, 0, 7); g.fill(); }
      g.fillStyle = color === "yellow" || color === "gold" ? "#c9762c" : "#ffd84a"; g.beginPath(); g.arc(fx, fy, TS * 0.045, 0, 7); g.fill();
    }
  }
  // 러그·길처럼 바닥에 납작하게 꽉 채워 그림
  drawFlat(g, f, sx, sy, w, h) {
    g.imageSmoothingEnabled = false;
    const rot = (f.rot || 0) % 2 === 1;
    const draw = c => { if (rot) { g.save(); g.translate(sx + w / 2, sy + h / 2); g.rotate(Math.PI / 2); g.drawImage(c, -h / 2, -w / 2, h, w); g.restore(); } else g.drawImage(c, sx, sy, w, h); };
    draw(this.flatCanvas(f.type, f.tint));
  }
  // 러그·길 그림: 원본을 칸에 꽉 채움(색칠 반영)
  flatCanvas(type, tint) {
    const ck = "flat|" + type + "|" + (tint ?? "");
    if (TINTC.has(ck)) return TINTC.get(ck);
    const raw = furnRawImg(type), d = this.d.furniture[type];
    let src = raw;
    if (!raw || !raw.naturalWidth) src = furnArt(type, d.w, d.h, 0);
    else { const c0 = document.createElement("canvas"); c0.width = raw.naturalWidth; c0.height = raw.naturalHeight; c0.getContext("2d").drawImage(raw, 0, 0); src = c0; }
    const color = Number.isSafeInteger(tint) && this.d.farm.dyes[tint] ? this.d.farm.dyes[tint].color : null;
    const c = color ? tinted(src, color, ck + "#") : src;
    TINTC.set(ck, c); return c;
  }
  drawFurn(g, f, w, h, sx, sy, TS) {
    g.imageSmoothingEnabled = true;
    const fc = this.furnCanvas(f, w, h), up = fc.over || 0;
    g.drawImage(fc, sx, sy - up * TS, w * TS, (h + up) * TS);
    g.imageSmoothingEnabled = false;
  }
  furnCanvas(f, w, h) {
    const fc = furnArt(f.type, w, h, f.rot || 0);
    const color = Number.isSafeInteger(f.tint) && this.d.farm.dyes[f.tint] ? this.d.farm.dyes[f.tint].color : null;
    return color ? tinted(fc, color, `${f.type}|${w}|${h}|${f.rot || 0}|${f.tint}`) : fc;
  }

  // ---------- 집 안 ----------
  styleOf(player, roomId) { return roomStyleOf(player, roomId, this.d.decor); }
  // 벽(맨 위 줄 앞면)·옆벽·바닥 칠하기 — game.drawHouse의 칸 그리기 대신
  wallFill(g, sx, sy, TS, x, y, style, up) {
    const s = this.d.decor.walls[style.wall];
    if (style.wall === 0) return false;
    g.fillStyle = y === 0 ? s.a : shade(s.a, -18); g.fillRect(sx, sy, TS + 1, TS + 1);
    if (y === 0) pattern(g, s.pat, s.b, sx, sy, TS, x, y);
    return true;
  }
  floorFill(g, sx, sy, TS, x, y, style) {
    const s = this.d.decor.floors[style.floor];
    if (style.floor === 0) return false;
    g.fillStyle = s.pat === "check" ? ((x + y) % 2 ? s.a : s.b) : s.a; g.fillRect(sx, sy, TS + 1, TS + 1);
    if (s.pat !== "check") pattern(g, s.pat, s.b, sx, sy, TS, x, y);
    return true;
  }
  // 집 안 가구를 층별로: rug(바닥 바로 위) / wall(맨 위 벽) / floor·top(정렬 목록)
  addHouseItems(list, g, p, roomId, ox, oy, TS, deco) {
    const defs = this.d.furniture, flats = [];
    const floorAt = new Map();
    for (const [id, f] of Object.entries(p.furn)) {
      if (f.state !== "placed" || f.room !== roomId || layerOf(defs, f.type) !== "floor") continue;
      const d = defs[f.type]; if (!d) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) floorAt.set(key(f.x + x, f.y + y), f.y + h);
    }
    for (const [id, f] of Object.entries(p.furn)) {
      if (f.state !== "placed" || f.room !== roomId) continue;
      const d = defs[f.type]; if (!d) continue;
      const L = layerOf(defs, f.type), [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      const sx = ox + f.x * TS, sy = oy + f.y * TS, pick = () => { if (deco && deco.picked === id) { g.strokeStyle = "#ffd35c"; g.lineWidth = 3; g.strokeRect(sx, sy, w * TS, h * TS); } };
      if (L === "rug") { flats.push(() => { this.drawFlat(g, f, sx, sy, w * TS, h * TS); pick(); }); continue; }
      if (L === "wall") { list.push({ y: 0.6, f: () => { g.imageSmoothingEnabled = true; const fc = this.furnCanvas(f, w, h); g.drawImage(fc, sx + TS * 0.08, sy + TS * 0.04, w * TS - TS * 0.16, TS * 0.66); g.imageSmoothingEnabled = false; this.drawShow(g, f, sx + TS * 0.2, sy + TS * 0.1, TS * 0.42); pick(); } }); continue; }
      if (L === "top") { const by = floorAt.get(key(f.x, f.y)) || f.y + 1; list.push({ y: by + 0.01, f: () => { g.imageSmoothingEnabled = true; const fc = this.furnCanvas(f, 1, 1); g.drawImage(fc, sx + TS * 0.12, sy - TS * 0.32, TS * 0.76, TS * 0.76); g.imageSmoothingEnabled = false; pick(); } }); continue; }
      if (L !== "floor") continue;
      list.push({ y: f.y + h, f: () => { this.drawFurn(g, f, w, h, sx, sy, TS); if (f.type === "fish_tank") this.drawShow(g, f, sx + TS * 0.22, sy + TS * 0.05, TS * 0.56); pick(); } });
    }
    return flats;
  }
  drawShow(g, f, x, y, s) {
    if (typeof f.show !== "string") return;
    const img = iconImg(f.show);
    if (img) { g.imageSmoothingEnabled = false; g.drawImage(img, x, y, s, s); }
    else { const it = this.d.items[f.show]; if (it) { g.font = `${Math.round(s * 0.8)}px sans-serif`; g.textAlign = "center"; g.fillText(it.icon, x + s / 2, y + s * 0.8); } }
  }
  // 밤(20시~5시)엔 집 안이 어둡고 등 둘레만 밝게
  drawNight(g, p, roomId, ox, oy, TS, W_, H_) {
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    const dark = hr >= 20 || hr < 5 ? 0.5 : hr >= 18.5 || hr < 6.5 ? 0.25 : 0;
    if (!dark) return;
    if (!this.nightC) this.nightC = document.createElement("canvas");
    const c = this.nightC; if (c.width !== W_ || c.height !== H_) { c.width = W_; c.height = H_; }
    const n = c.getContext("2d"); n.globalCompositeOperation = "source-over"; n.clearRect(0, 0, W_, H_);
    n.fillStyle = `rgba(16,20,52,${dark})`; n.fillRect(0, 0, W_, H_);
    n.globalCompositeOperation = "destination-out";
    const flick = 1 + Math.sin(performance.now() / 180) * 0.03;
    for (const f of Object.values(p.furn)) {
      if (f.state !== "placed" || f.room !== roomId) continue;
      const d = this.d.furniture[f.type]; if (!d || !d.light) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      const cx = ox + (f.x + w / 2) * TS, cy = oy + (f.y + h / 2) * TS, r = d.light * TS * flick;
      const gr = n.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.6, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = gr; n.beginPath(); n.arc(cx, cy, r, 0, 7); n.fill();
    }
    g.drawImage(c, 0, 0, W_, H_);
    // 불빛 색(따뜻한 노랑)
    for (const f of Object.values(p.furn)) {
      if (f.state !== "placed" || f.room !== roomId) continue;
      const d = this.d.furniture[f.type]; if (!d || !d.light) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      const cx = ox + (f.x + w / 2) * TS, cy = oy + (f.y + h / 2) * TS, r = d.light * TS * 0.8;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, "rgba(255,210,120,.28)"); gr.addColorStop(1, "rgba(255,210,120,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
  }
  // 섬 밤: 가로등 불빛
  drawIslandLights(g, TS, camX, camY) {
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    if (!(hr >= 18.5 || hr < 6.5)) return;
    for (const m of MIDS) for (const v of this.valid[m] || []) {
      const d = this.d.furniture[v.f.type]; if (!d.light) continue;
      const cx = v.cells[0][0] * TS - camX + TS / 2, cy = v.cells[0][1] * TS - camY - TS * 0.2, r = d.light * TS;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, "rgba(255,214,130,.35)"); gr.addColorStop(1, "rgba(255,214,130,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    }
  }

  // ---------- 마당 꾸미기 ----------
  nearMyYard() {
    const h = this.game.world.houseOf(state.mid), m = this.game.me; if (!h) return false;
    return m.x >= h.x - BAND - 1 && m.x <= h.x + h.w + BAND + 1 && m.y >= h.y - BAND - 1 && m.y <= h.y + h.h + BAND + 2;
  }
  hiddenMine() { return state.player ? hiddenYard(this.d.furniture, state.player, state.mid, this.ctx()) : []; }
  async yardTap(sx, sy) {
    const g = this.game, deco = g.deco, TS = g.TS;
    const tx = Math.floor((sx + g.camX) / TS), ty = Math.floor((sy + g.camY) / TS);
    const h = g.world.houseOf(state.mid), p = state.player;
    if (!deco.sel) {
      const hit = (this.valid[state.mid] || []).filter(v => v.cells.some(([a, b]) => a === tx && b === ty)).sort((a, b) => (a.layer === "path") - (b.layer === "path"))[0];
      if (hit) g.ui.decoPicked(hit.id);
      return;
    }
    const f = p.furn[deco.sel]; if (!f) return;
    const rx = tx - h.x + OFF, ry = ty - h.y + OFF, rot = f.state === "placed" && f.room === "yard" ? (f.rot || 0) : 0;
    const avoid = this.people();
    const chk = canPlaceYard(this.d.furniture, p, state.mid, this.ctx(), deco.sel, rx, ry, rot, this.solidOthers, avoid);
    if (!chk.ok) { g.ui.toast("여기엔 놓을 수 없어요 (" + chk.reason + ")"); return; }
    const selId = deco.sel; g.ui.busy(true);
    const r = await P.decorTx(pl => placeYard(this.d.furniture, pl, state.mid, this.ctx(), selId, rx, ry, rot, W.today(), this.solidOthers, this.people())).catch(() => ({ ok: false }));
    g.ui.busy(false);
    if (!r.ok) { g.ui.toast("놓지 못했어요 (" + (r.reason || "저장 실패") + ")"); return; }
    if (g.deco === deco && deco.sel === selId) { deco.sel = null; g.ui.decoRefresh(); }
  }
  async yardRotate(id) {
    const p = state.player, f = p.furn[id]; if (!f || f.room !== "yard") return { ok: false };
    const rot = ((f.rot || 0) + 1) % 4;
    return P.decorTx(pl => placeYard(this.d.furniture, pl, state.mid, this.ctx(), id, pl.furn[id].x, pl.furn[id].y, rot, W.today(), this.solidOthers, this.people())).catch(() => ({ ok: false }));   // ⑦ 돌리기도 가족이 선 칸 피함
  }
  // 나와 섬의 다른 가족이 서 있는 칸(놓기·돌리기 공통, 부를 때마다 최신)
  people() {
    const s = new Set([key(Math.floor(this.game.me.x), Math.floor(this.game.me.y))]);
    for (const o of W.othersHere().values()) s.add(key(Math.floor(o.x), Math.floor(o.y)));
    return s;
  }
}

function shade(hex, d) { const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, v + d)); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }
// 벽지·바닥 무늬(코드 그림)
function pattern(g, pat, b, sx, sy, TS, x, y) {
  g.fillStyle = b; g.strokeStyle = b;
  if (pat === "stripe") { for (let i = 0; i < 3; i++) g.fillRect(sx + TS * (i / 3 + 0.08), sy, TS * 0.12, TS); }
  else if (pat === "heart") { if ((x + y) % 2 === 0) heart(g, sx + TS / 2, sy + TS * 0.42, TS * 0.18); }
  else if (pat === "star") { if ((x * 7 + y * 3) % 3 !== 1) star(g, sx + TS * (0.3 + ((x * 13) % 5) / 12), sy + TS * (0.3 + ((x * 7) % 4) / 10), TS * 0.08); }
  else if (pat === "plank") { g.globalAlpha = 0.5; g.fillRect(sx, sy + TS * 0.32, TS, TS * 0.04); g.fillRect(sx, sy + TS * 0.66, TS, TS * 0.04); if (x % 2) g.fillRect(sx + TS * 0.5, sy, TS * 0.04, TS * 0.33); g.globalAlpha = 1; }
  else if (pat === "dot") { g.beginPath(); g.arc(sx + TS * 0.3, sy + TS * 0.35, TS * 0.07, 0, 7); g.arc(sx + TS * 0.75, sy + TS * 0.7, TS * 0.07, 0, 7); g.fill(); }
  else if (pat === "cloud") { if ((x + y) % 3 === 0) { g.beginPath(); g.arc(sx + TS * 0.35, sy + TS * 0.45, TS * 0.14, 0, 7); g.arc(sx + TS * 0.55, sy + TS * 0.38, TS * 0.17, 0, 7); g.arc(sx + TS * 0.72, sy + TS * 0.47, TS * 0.12, 0, 7); g.fill(); } }
  else if (pat === "brick") { g.globalAlpha = 0.9; g.fillRect(sx, sy + TS * 0.48, TS, TS * 0.05); g.fillRect(sx + (y % 2 ? TS * 0.5 : 0), sy, TS * 0.05, TS * 0.48); g.fillRect(sx + (y % 2 ? 0 : TS * 0.5), sy + TS * 0.5, TS * 0.05, TS * 0.5); g.globalAlpha = 1; }
  else if (pat === "grass") { g.globalAlpha = 0.6; for (let i = 0; i < 4; i++) g.fillRect(sx + TS * (0.15 + i * 0.22), sy + TS * (0.3 + ((x + i) % 3) * 0.18), TS * 0.05, TS * 0.14); g.globalAlpha = 1; }
  else if (pat === "tile") { g.lineWidth = 1; g.strokeRect(sx + 1, sy + 1, TS - 2, TS - 2); }
  else if (pat === "soft") { g.globalAlpha = 0.35; g.beginPath(); g.arc(sx + TS / 2, sy + TS / 2, TS * 0.2, 0, 7); g.fill(); g.globalAlpha = 1; }
}
function heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.5, y - s * 1.3, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.5, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s); g.fill(); }
function star(g, x, y, s) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
