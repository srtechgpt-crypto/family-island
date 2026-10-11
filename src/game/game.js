// 게임 화면: 섬·집 그리기, 걷기, 행동(흔들기·줍기·낚시·문), 꾸미기
import { T, WATER } from "./world.js";
import { SPR, DROP_SPR, FORAGE_SPR, renderGround } from "./sprites.js";
import { furnArt } from "./furnArt.js";
import { drawCharacter } from "./character.js";
import { renderMapBase, drawMap } from "./minimap.js";
import * as EM from "../services/emoteStore.js";
import { appearanceOf } from "../domain/appearance.js";
import { emoteProgress } from "../domain/emotes.js";
import { mapMarkers } from "../domain/mapMarkers.js";
import { pickForage } from "../domain/forage.js";
import { state, onState } from "../state.js";
import { FAMILY, familyOf, nameOf, FISH_WINDOW } from "../config/gameConfig.js";
import { isConnected, serverNow } from "../services/fb.js";
import * as W from "../services/worldStore.js";
import * as P from "../services/playerStore.js";
import { pickFish, judge } from "../domain/fishing.js";
import { canPlace } from "../domain/placement.js";
import { zoneOf } from "../domain/rounds.js";
import { treeDropSpots } from "../domain/housing.js";
import { HouseLayer } from "./v3house.js";
import { CampLayer } from "./v3camp.js";
import { BugLayer } from "./v3bugs.js";
import * as SP from "../audio/songPlayer.js";

const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];

export class Game {
  constructor(canvas, world, data, ui) {
    this.cv = canvas; this.g = canvas.getContext("2d");
    this.world = world; this.data = data; this.ui = ui;
    this.ground = renderGround(world);
    this.houseL = new HouseLayer(this);   // v3: 공유 집 위치를 먼저 반영
    this.camp = new CampLayer(this);
    this.bugs = new BugLayer(this);
    this.sneak = false;
    const h = world.houseOf(state.mid) || world.houses[0];
    this.me = { x: h.door.x + 0.5, y: h.door.y + 1.5, dir: 0, walk: 0 };
    this.mode = "island"; this.houseMid = null; this.room = "living"; this.housePlayer = null; this.houseUnsub = null;
    this.keys = {}; this.joy = null; this.fishing = null; this.busy = false; this.deco = null;
    this.lastZone = null;
    this.mapBase = renderMapBase(world);
    this.forageOK = !!(data.forage && data.forage.ver === 1);   // 버섯 후보 목록 버전이 앱과 맞을 때만
    this.forageRound = null; this.forageList = [];
    this.MM = { x: 12, y: 58, w: 150, h: 112 };   // 미니맵 자리(화면 왼쪽 위, 시계 아래)
    this.resize(); addEventListener("resize", () => this.resize());
    this.bindInput();
    W.enterPlace("island"); EM.enterEmotePlace("island");
    W.watchAround(Math.floor(this.me.x), Math.floor(this.me.y));
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
    onState(w => { if (w === "player" && this.mode === "house" && this.houseMid === state.mid) this.housePlayer = state.player; });
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.islandTS = Math.max(28, Math.round(Math.min(this.H / 12, this.W / 14)));
    this.fitTS();
  }
  // 섬은 약 24×12칸이 보이게, 집 안은 방이 화면에 꽉 차게
  fitTS() {
    if (this.mode === "house" && this.data.rooms[this.room]) {
      const r = this.data.rooms[this.room];
      const free = this.deco ? this.W - this.decoReserve() - 16 : this.W - 260;   // 꾸미기 중엔 오른쪽 꾸미기 창을 피해서
      this.TS = Math.max(24, Math.floor(Math.min((this.H - 70) / (r.h + 0.6), free / r.w)));
    } else this.TS = this.islandTS;
  }

  // ---------- 입력 ----------
  bindInput() {
    addEventListener("keydown", e => { this.keys[e.key] = true; if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.act(); } });
    addEventListener("keyup", e => { this.keys[e.key] = false; });
    this.cv.addEventListener("pointerdown", e => {
      SP.unlock();
      if (this.deco) { this.decoTap(e.clientX, e.clientY); return; }
      const M = this.MM;
      if (this.mode === "island" && e.clientX >= M.x && e.clientX <= M.x + M.w && e.clientY >= M.y && e.clientY <= M.y + M.h) { this.ui.openMap(); return; }
      if (this.fishing) { this.act(); return; }
      if (e.clientX < this.W * 0.6) this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
    });
    this.cv.addEventListener("pointermove", e => { if (this.joy && e.pointerId === this.joy.id) { this.joy.dx = e.clientX - this.joy.ox; this.joy.dy = e.clientY - this.joy.oy; } });
    const end = e => { if (this.joy && e.pointerId === this.joy.id) this.joy = null; };
    this.cv.addEventListener("pointerup", end); this.cv.addEventListener("pointercancel", end);
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.fishing) { this.fishing = null; } });
  }

  // ---------- 충돌 ----------
  blocked(x, y) {
    if (this.mode === "island") return !this.world.walkable(x, y);
    const room = this.data.rooms[this.room], tx = Math.floor(x), ty = Math.floor(y);
    if ((room.links || []).some(l => l.x === tx && l.y === ty)) return false;
    if (room.door.some(([dx, dy]) => dx === tx && dy === ty)) return false;
    if (tx <= 0 || ty <= 0 || tx >= room.w - 1 || ty >= room.h - 1) return true;
    if (room.blocked.some(([bx, by]) => bx === tx && by === ty)) return true;
    return this.furnCells().has(tx + "," + ty);
  }
  furnCells() {
    const set = new Set(), p = this.housePlayer; if (!p) return set;
    for (const f of Object.values(p.furn)) {
      if (f.state !== "placed" || f.room !== this.room) continue;
      const d = this.data.furniture[f.type]; if (!d) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set.add((f.x + x) + "," + (f.y + y));
    }
    return set;
  }
  furnAt(tx, ty) {
    const p = this.housePlayer; if (!p) return null;
    for (const f of Object.values(p.furn)) {
      if (f.state !== "placed" || f.room !== this.room) continue;
      const d = this.data.furniture[f.type]; if (!d) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      if (tx >= f.x && tx < f.x + w && ty >= f.y && ty < f.y + h) return f.type;
    }
    return null;
  }
  move(dx, dy) {
    const m = this.me, r = 0.28;
    const ok = (x, y) => !this.blocked(x - r, y) && !this.blocked(x + r, y) && !this.blocked(x - r, y + 0.2) && !this.blocked(x + r, y + 0.2);
    if (ok(m.x + dx, m.y)) m.x += dx;
    if (ok(m.x, m.y + dy)) m.y += dy;
  }

  // ---------- 앞에 있는 것 ----------
  front() { const d = DIRS[this.me.dir]; return { x: Math.floor(this.me.x + d[0] * 0.8), y: Math.floor(this.me.y + d[1] * 0.8) }; }
  target() {
    const m = this.me, round = W.today();
    if (this.houseL.move) return { k: "houseMove", label: this.houseL.move.res && this.houseL.move.res.ok ? "여기로 옮기기" : "여긴 안 돼요" };
    if (this.camp.roast) return { k: "roast", label: "꺼내기!" };
    if (this.mode === "house") {
      const room = this.data.rooms[this.room], f = this.front(), tx = Math.floor(m.x), ty = Math.floor(m.y);
      if (this.room === "living" && this.houseMid === state.mid && room.blocked.some(([x, y]) => x === f.x && y === f.y)) return { k: "bench", label: "만들기" };
      if (this.houseMid === state.mid && this.furnAt(f.x, f.y) === "stove_wood") return { k: "stove", label: "요리" };
      if (room.door.some(([x, y]) => x === tx && y === ty)) return { k: "exit", label: this.room === "living" ? "밖으로" : "거실로" };
      const link = (room.links || []).find(l => l.x === tx && l.y === ty);
      if (link) return { k: "link", to: link.to, label: this.data.rooms[link.to].name };
      return null;
    }
    for (const h of this.world.houses) if (Math.abs(m.x - (h.door.x + 0.5)) < 0.9 && Math.abs(m.y - (h.door.y + 1)) < 1.1)
      return { k: "door", h, label: h.mid === state.mid ? "우리 집" : nameOf(h.mid) + "네" };
    if (this.camp.near(m.x, m.y, 1.8)) return { k: "camp", label: "캠프파이어" };
    const bug = this.bugs.target(); if (bug) return bug;
    // 가까운 것(떨어진 과일 > 꽃·조개·잡초 > 나무·돌)
    let best = null, bd = 1.35;
    const consider = (o, kind, label) => { const d = Math.hypot(o.x + 0.5 - m.x, o.y + 0.5 - m.y); if (d < bd) { bd = d; best = { k: kind, o, label }; } };
    for (const d of this.fruitDrops()) consider(d, "drop", "줍기");
    if (!best) {
      for (const o of this.nearObjects()) {
        if (o.k === "flower" || o.k === "shell") { if (!W.isTaken(o.zone, o.id)) consider(o, "pick", "줍기"); }
        else if (o.k === "weed") { if (!W.isTaken(o.zone, o.id)) consider(o, "pick", "뽑기"); }
      }
      for (const o of this.world.weedsFor(round)) if (Math.abs(o.x - m.x) < 2 && Math.abs(o.y - m.y) < 2 && !W.isTaken(o.zone, o.id)) consider(o, "pick", "뽑기");
      for (const o of this.forageToday(round)) if (Math.abs(o.x - m.x) < 2 && Math.abs(o.y - m.y) < 2 && !W.isTaken(o.zone, o.id)) consider({ ...o, round }, "forage", o.item.startsWith("herb") ? "뜯기" : "캐기");
    }
    if (!best) for (const o of this.nearObjects()) {
      if (o.k === "tree") consider(o, "tree", "흔들기");
      else if (o.k === "rock" || o.k === "stone") consider(o, "rock", "두드리기");
    }
    if (best) return best;
    const f = this.front(), t = this.world.tile(f.x, f.y);
    if (WATER[t]) return { k: "fish", water: WATER[t], fx: f.x, fy: f.y, label: "낚시" };
    return null;
  }
  forageToday(round) {
    if (!this.forageOK) return [];
    if (round !== this.forageRound) {
      this.forageRound = round;
      this.forageList = pickForage(this.data.forage.candidates, round, 24).map(c => ({ ...c, k: "forage", zone: zoneOf(c.x, c.y) }));
    }
    return this.forageList;
  }
  nearZones() { const zx = Math.floor(this.me.x / 16), zy = Math.floor(this.me.y / 16), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(`z${zx + dx}_${zy + dy}`); return out; }
  nearObjects() {
    const out = [], mx = Math.floor(this.me.x), my = Math.floor(this.me.y);
    for (let y = my - 2; y <= my + 2; y++) for (let x = mx - 2; x <= mx + 2; x++) { const o = this.world.objAt.get(x + "," + y); if (o) out.push(o); }
    return out;
  }

  // ---------- 행동 ----------
  async act() {
    if (state.kicked) return;
    if (this.fishing) return this.fishPress();
    if (this.busy) return;
    const t = this.target(); if (!t) return;
    if (t.k === "roast") return this.camp.pull();
    if (t.k === "houseMove") { const r = await this.houseL.confirm(); this.ui.houseMoveDone(r); return; }
    const needNet = ["drop", "pick", "tree", "rock", "fish", "bench", "forage", "camp", "bug"].includes(t.k);
    if (needNet && !isConnected()) { this.ui.toast("인터넷 연결을 기다리는 중이에요"); return; }
    if (t.k === "door") return this.enterHouse(t.h.mid);
    if (t.k === "exit") return this.room === "living" ? this.leaveHouse() : this.goRoom(this.data.rooms[this.room].back.room, this.data.rooms[this.room].back);
    if (t.k === "link") return this.goRoom(t.to);
    if (t.k === "bench") return this.ui.openCraft();
    if (t.k === "camp") return this.ui.openCamp();
    if (t.k === "stove") return this.ui.openCook("stove");
    if (t.k === "bug") return this.bugs.catchIt(t.o);
    if (t.k === "fish") { this.fishing = { st: "wait", water: t.water, bx: t.fx + 0.5, by: t.fy + 0.5, until: performance.now() + 2000 + Math.random() * 4500 }; return; }
    this.busy = true;
    try {
      if (t.k === "tree") await this.shakeTree(t.o);
      else if (t.k === "rock") await this.gain(t.o.zone, `${t.o.id}_s_${state.mid}`, "stone", 1, "오늘은 이 돌에서 더 안 나와요");
      else if (t.k === "drop") await this.gain(t.o.zone, t.o.id, t.o.item, 1);
      else if (t.k === "forage") {
        // 고른 순간의 회차와 오늘 목록이 같을 때만(오전 5시를 넘겼으면 다시 보기)
        if (W.today() !== t.o.round || !this.forageToday(W.today()).some(f => f.id === t.o.id)) this.ui.toast("새 날이 밝았어요! 숲을 다시 둘러봐요");
        else await this.gain(t.o.zone, t.o.id, t.o.item, 1);
      }
      else if (t.k === "pick") {
        const item = t.o.k === "flower" ? "flower_" + (t.o.c || "red") : t.o.k === "shell" ? "shell" : "weed";
        await this.gain(t.o.zone, t.o.id, item, 1);
      }
    } finally { this.busy = false; }
  }
  async gain(zone, pid, item, qty, takenMsg) {
    this.ui.busy(true);
    const r = await W.claim(zone, pid, item, qty).catch(() => ({ ok: false, reason: "실패" }));
    if (!r.ok) { this.ui.busy(false); this.ui.toast(r.reason === "먼저" ? "앗, 가족이 먼저 가져갔어요" : (takenMsg || "지금은 가져갈 수 없어요")); return false; }
    const g = await P.giveClaim(r.claim).catch(() => ({ ok: false }));
    this.ui.busy(false);
    if (!g.ok) { this.ui.toast("저장이 잠시 안 됐어요. 다시 들어오면 받아요"); return false; }
    if (qty > 0) { const it = this.data.items[item]; this.ui.toast(`${it.icon} ${it.name}${qty > 1 ? " ×" + qty : ""} 가방에 넣었어요`); }
    return true;
  }
  async shakeTree(o) {
    o.shake = 14;
    // 나뭇가지: 사람마다 나무마다 하루 1번
    const gotBranch = await this.gain(o.zone, `${o.id}_b_${state.mid}`, "branch", 1, "");
    // 과일: 가족 공유, 나무마다 하루 1번 → 바닥에 3개 떨어짐
    const fruit = (parseInt(o.id.slice(1), 10) || 0) % 3 === 0 ? "orange" : "apple";
    const r = await W.claim(o.zone, o.id, fruit, 0).catch(() => ({ ok: false }));
    if (r.ok) this.ui.toast(`${this.data.items[fruit].icon} 열매가 떨어졌어요!`);
    else if (!gotBranch) this.ui.toast("오늘은 이 나무에서 더 안 떨어져요");
  }
  fruitOf(o) { return (parseInt(o.id.slice(1), 10) || 0) % 3 === 0 ? "orange" : "apple"; }
  // 오늘 흔들린 나무 둘레의 열매(주운 것 빼고). ID는 나무ID_f0~2, 기록은 나무의 구역에.
  fruitDrops() {
    const out = [], mx = Math.floor(this.me.x), my = Math.floor(this.me.y);
    for (let y = my - 4; y <= my + 4; y++) for (let x = mx - 4; x <= mx + 4; x++) {
      const o = this.world.objAt.get(x + "," + y);
      if (!o || o.k !== "tree" || !W.isTaken(o.zone, o.id)) continue;
      // 떨어지는 칸은 지도 기준으로 고정(집을 옮겨도 모든 폰이 같은 자리), 집에 가린 것만 숨김
      treeDropSpots(this.world.map, o, 3).forEach((s, i) => { const id = `${o.id}_f${i}`; if (!W.isTaken(o.zone, id) && !this.world.inHouse(s.x, s.y)) out.push({ id, zone: o.zone, x: s.x, y: s.y, item: this.fruitOf(o) }); });
    }
    return out.concat(this.bugs.honeyDrops(W.today(), mx, my));
  }
  fishPress() {
    const f = this.fishing, now = performance.now();
    if (f.st === "wait") { this.fishing = null; this.ui.toast("너무 빨랐어요. 찌가 쏙 들어갈 때 눌러요"); return; }
    if (f.st !== "bite") return;
    const win = FISH_WINDOW[state.mid] || FISH_WINDOW.default;
    const res = judge(Math.round(f.biteAt), Math.round(now), win);
    this.fishing = null;
    if (res !== "hit") { this.ui.toast("앗, 놓쳤어요!"); return; }
    const fish = pickFish(this.data.fish, f.water, Math.random);
    this.ui.busy(true);
    P.addFish(fish, Date.now()).then(r => {
      this.ui.busy(false);
      if (!r.ok) { this.ui.toast("저장이 안 됐어요. 연결을 확인해 주세요"); return; }
      this.ui.fishCaught(fish, r.first);
    }).catch(() => { this.ui.busy(false); this.ui.toast("저장이 안 됐어요"); });
  }

  // ---------- 집 ----------
  enterHouse(mid) {
    this.mode = "house"; this.houseMid = mid; this.islandPos = { x: this.me.x, y: this.me.y };
    this.goRoom("living");
    if (this.houseUnsub) this.houseUnsub();
    if (mid === state.mid) { this.housePlayer = state.player; this.houseUnsub = null; }
    else { this.housePlayer = null; this.houseUnsub = P.watchPlayer(mid, p => { this.housePlayer = p; }); }
    W.enterPlace("house_" + mid); EM.enterEmotePlace("house_" + mid);
    this.ui.inHouse(mid === state.mid, nameOf(mid));
  }
  goRoom(id, at) {
    const room = this.data.rooms[id]; this.room = id; this.fitTS();
    if (at) { this.me.x = at.x + 0.5; this.me.y = at.y + 1.5; this.me.dir = 0; }
    else { const [dx, dy] = room.door[0]; this.me.x = dx + 0.5; this.me.y = dy - 0.5; this.me.dir = 3; }
    if (this.deco) this.ui.decoRefresh();
  }
  leaveHouse() {
    if (this.houseUnsub) this.houseUnsub(); this.houseUnsub = null;
    this.mode = "island"; this.deco = null; this.ui.decoClose(); this.fitTS();
    // 그사이 집이 옮겨졌을 수 있으니 지금 집의 문 앞으로
    const hs = this.world.houseOf(this.houseMid);
    if (hs) { this.me.x = hs.door.x + 0.5; this.me.y = hs.door.y + 1.5; } else { this.me.x = this.islandPos.x; this.me.y = this.islandPos.y + 0.4; }
    this.me.dir = 0;
    W.enterPlace("island"); EM.enterEmotePlace("island"); this.ui.inHouse(false, null, true);
  }
  // 꾸미기 창(index.html #pDeco: 너비 min(46vw,340px), 오른쪽 12px)이 차지하는 폭
  decoReserve() { return Math.min(this.W * 0.46, 340) + 24; }
  houseOrigin() { const room = this.data.rooms[this.room], left = this.deco ? this.W - this.decoReserve() : this.W; return { ox: (left - room.w * this.TS) / 2, oy: (this.H - room.h * this.TS) / 2 + this.TS * 0.3 }; }

  // 꾸미기: 고른 가구를 바닥에 놓기 / 놓인 가구 누르기 → 선택
  startDeco() { if (this.mode === "house" && this.houseMid === state.mid) { this.deco = { sel: null }; this.fitTS(); return true; } return false; }
  stopDeco() { this.deco = null; this.fitTS(); }
  decoSelect(furnId) { if (this.deco) this.deco.sel = furnId; }
  async decoTap(sx, sy) {
    const { ox, oy } = this.houseOrigin(), tx = Math.floor((sx - ox) / this.TS), ty = Math.floor((sy - oy) / this.TS);
    const p = state.player, room = this.data.rooms[this.room];
    const hit = Object.entries(p.furn).find(([, f]) => {
      if (f.state !== "placed" || f.room !== this.room) return false;
      const d = this.data.furniture[f.type], [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      return tx >= f.x && tx < f.x + w && ty >= f.y && ty < f.y + h;
    });
    if (hit && !this.deco.sel) { this.ui.decoPicked(hit[0]); return; }
    if (!this.deco.sel) return;
    if (Math.floor(this.me.x) === tx && Math.floor(this.me.y) === ty) { this.ui.toast("캐릭터가 서 있는 자리예요"); return; }
    const f = p.furn[this.deco.sel];
    const chk = canPlace(room, this.data.furniture, p, this.deco.sel, tx, ty, f.rot || 0);
    if (!chk.ok) { this.ui.toast("여기엔 놓을 수 없어요 (" + chk.reason + ")"); return; }
    this.ui.busy(true);
    const r = await P.placeFurniture(room, this.data.furniture, this.deco.sel, tx, ty, f.rot || 0).catch(() => ({ ok: false }));
    this.ui.busy(false);
    if (!r.ok) { this.ui.toast("놓지 못했어요 (" + (r.reason || "저장 실패") + ")"); return; }
    this.deco.sel = null; this.ui.decoRefresh();
  }

  // ---------- 반복 ----------
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    let mx = 0, my = 0;
    if (this.joy) { const d = Math.hypot(this.joy.dx, this.joy.dy); if (d > 8) { const s = Math.max(d, 45); mx = this.joy.dx / s; my = this.joy.dy / s; } }
    if (this.keys.ArrowLeft) mx = -1; if (this.keys.ArrowRight) mx = 1; if (this.keys.ArrowUp) my = -1; if (this.keys.ArrowDown) my = 1;
    if (this.fishing || this.deco || state.kicked || this.ui.modalOpen() || this.camp.roast) mx = my = 0;
    if (this.fishing) {
      if (this.fishing.st === "wait" && now > this.fishing.until) { this.fishing.st = "bite"; this.fishing.biteAt = now; this.ui.bite(); }
      else if (this.fishing.st === "bite" && now - this.fishing.biteAt > (FISH_WINDOW[state.mid] || FISH_WINDOW.default) + 150) { this.fishing = null; this.ui.toast("앗, 놓쳤어요. 쏙! 할 때 눌러요"); }
    }
    this.me.moving = !!(mx || my);
    if (mx || my) {
      const sp = (this.sneak ? 2.1 : 4.2) * dt; this.move(mx * sp, my * sp); this.me.walk += dt / 1.2;
      this.me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
    }
    W.sendPos(this.me.x, this.me.y, this.me.dir, false, this.camp.heartbeatMs());
    this.houseL.update(); this.camp.tick(); this.bugs.tick(dt);
    if (this.mode === "island") {
      const z = zoneOf(Math.floor(this.me.x), Math.floor(this.me.y));
      // 구역이 바뀌거나 오전 5시가 지나 회차가 바뀌면 다시 구독
      if (z !== this.lastZone || (now - (this.lastRoundCheck || 0) > 5000 && (this.lastRoundCheck = now) && W.today() !== W.watchedRound())) { this.lastZone = z; W.watchAround(Math.floor(this.me.x), Math.floor(this.me.y)); }
    }
    for (const o of W.othersHere().values()) {
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy);
      o.moving = d > 0.03;
      if (d > 6) { o.x = o.tx; o.y = o.ty; } else if (d > 0.01) { const k = Math.min(1, dt * 8); o.x += dx * k; o.y += dy * k; o.walk += dt / 1.2; }
    }
    if (this.mode === "island") { this.drawIsland(now, dt); this.drawMini(); } else this.drawHouse();
    this.camp.drawOverlay(this.g, dt);
    this.drawJoy();
    const t = this.fishing ? { label: this.fishing.st === "bite" ? "지금!" : "기다려요" } : this.target();
    this.ui.setAction(t ? t.label : null);
    requestAnimationFrame(t2 => this.loop(t2));
  }

  // 감정: 내 것은 내 세션 기록, 다른 가족은 그 사람의 현재 세션 기록만
  emoteOf(mid) {
    const cur = mid === state.mid ? state.ses : state.members[mid] && state.members[mid].ses;
    const e = cur && EM.emotesHere()[cur];
    if (!e || e.m !== mid) return null;
    const p = emoteProgress(e, serverNow());
    return p === null ? null : { kind: e.kind, p };
  }
  drawPerson(mid, x, y, dir, walk, moving) {
    const g = this.g, TS = this.TS, f = familyOf(mid) || FAMILY[0], name = nameOf(mid);
    const look = appearanceOf(state.members[mid] && state.members[mid].appearance, mid);
    const s = TS * 1.6;
    const sway = this.mode === "island" ? this.camp.swayOf(mid, (x + this.camX) / TS, (y + this.camY) / TS) : 0;
    if (sway) { g.save(); g.translate(x, y + TS * 0.25); g.rotate(sway); g.translate(-x, -(y + TS * 0.25)); }
    const { headTop } = drawCharacter(g, look, this.data.appearance, x, y + TS * 0.25, s, dir, walk, moving, this.emoteOf(mid));
    if (sway) g.restore();
    g.font = `${Math.round(TS * 0.36)}px Jua, sans-serif`; g.textAlign = "center";
    const tw = g.measureText(name).width + 10, ty = headTop - TS * 0.12;
    g.fillStyle = "rgba(255,253,246,.92)"; g.beginPath(); g.roundRect(x - tw / 2, ty - TS * 0.42, tw, TS * 0.42, 8); g.fill();
    g.fillStyle = f.color; g.fillText(name, x, ty - TS * 0.1);
  }

  drawMini() {
    const g = this.g, M = this.MM;
    g.fillStyle = "rgba(255,253,246,.92)"; g.strokeStyle = "#2f5d3a"; g.lineWidth = 3;
    g.beginPath(); g.roundRect(M.x - 3, M.y - 3, M.w + 6, M.h + 6, 12); g.fill(); g.stroke();
    const marks = mapMarkers(W.allPresence(), state.members, this.world.houses, state.mid, serverNow());
    drawMap(g, this.mapBase, this.world, M.x, M.y, M.w, M.h, marks, { x: this.me.x, y: this.me.y }, state.mid, m => familyOf(m).color, nameOf, false);
  }
  drawBigMap(cv) {
    const g = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#4aa9c9"; g.fillRect(0, 0, w, h);
    const marks = mapMarkers(W.allPresence(), state.members, this.world.houses, state.mid, serverNow());
    let me = { x: this.me.x, y: this.me.y };
    if (this.mode === "house") { const hs = this.world.houseOf(this.houseMid); me = { x: hs.door.x + 0.5, y: hs.door.y + 0.5 }; }
    drawMap(g, this.mapBase, this.world, 6, 6, w - 12, h - 12, marks, me, state.mid, m => familyOf(m).color, nameOf, true);
  }

  drawIsland(now, dt = 0) {
    const g = this.g, TS = this.TS, S = TS / 16, m = this.me, round = W.today();
    const camX = m.x * TS - this.W / 2, camY = m.y * TS - this.H / 2;
    this.camX = camX; this.camY = camY;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#4aa9c9"; g.fillRect(0, 0, this.W, this.H);
    const sx = camX / S, sy = camY / S, sw = this.W / S, sh = this.H / S;
    g.drawImage(this.ground, sx, sy, sw, sh, 0, 0, this.W, this.H);
    const x0 = Math.floor(camX / TS) - 2, y0 = Math.floor(camY / TS) - 2, x1 = x0 + Math.ceil(this.W / TS) + 4, y1 = y0 + Math.ceil(this.H / TS) + 4;
    const list = [];
    this.houseL.addHouses(list, g, TS, camX, camY, x0, y0, x1, y1);
    this.camp.addToList(list, g, TS, camX, camY, x0, y0, x1, y1, dt, now / 1000);
    this.bugs.addToList(list, g, TS, camX, camY, x0, y0, x1, y1);
    for (let y = Math.max(0, y0); y < y1; y++) for (let x = Math.max(0, x0); x < x1; x++) {
      const o = this.world.objAt.get(x + "," + y); if (!o) continue;
      const px = x * TS - camX, py = y * TS - camY;
      if (o.k === "tree") list.push({ y: y + 0.95, f: () => {
        const s = o.shake ? Math.sin(o.shake-- * 1.4) * TS * 0.06 : 0;
        g.drawImage(SPR.tree, px + s, py - TS * 0.5, TS, TS * 1.5);
        if (!W.isTaken(o.zone, o.id)) g.drawImage((parseInt(o.id.slice(1), 10) || 0) % 3 === 0 ? SPR.fruitOrange : SPR.fruitApple, px + s, py - TS * 0.5, TS, TS * 1.5);
      } });
      else if (o.k === "rock" || o.k === "stone") list.push({ y: y + 0.5, f: () => g.drawImage(SPR.rock, px, py, TS, TS) });
      else if ((o.k === "flower" || o.k === "shell") && !W.isTaken(o.zone, o.id)) list.push({ y: y + 0.3, f: () => g.drawImage(o.k === "shell" ? SPR.shell : SPR.flower[o.c] || SPR.flower.red, px, py, TS, TS) });
    }
    for (const o of this.world.weedsFor(round)) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1 && !W.isTaken(o.zone, o.id) && !this.world.inHouse(o.x, o.y))
      list.push({ y: o.y + 0.3, f: () => g.drawImage(SPR.weed, o.x * TS - camX, o.y * TS - camY, TS, TS) });
    for (const o of this.forageToday(round)) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1 && !W.isTaken(o.zone, o.id) && !this.world.inHouse(o.x, o.y))
      list.push({ y: o.y + 0.3, f: () => g.drawImage(FORAGE_SPR[o.item] || FORAGE_SPR.mushroom_red, o.x * TS - camX, o.y * TS - camY, TS, TS) });
    for (const d of this.fruitDrops())
      list.push({ y: d.y + 0.4, f: () => { g.imageSmoothingEnabled = d.item === "honeycomb"; g.drawImage(DROP_SPR[d.item] || DROP_SPR.apple, d.x * TS - camX, d.y * TS - camY, TS, TS); g.imageSmoothingEnabled = false; } });
    for (const o of W.othersHere().values()) list.push({ y: o.y, f: () => this.drawPerson(o.m, o.x * TS - camX, o.y * TS - camY, o.d || 0, o.walk, o.moving) });
    list.push({ y: m.y, f: () => this.drawPerson(state.mid, m.x * TS - camX, m.y * TS - camY, m.dir, m.walk, m.moving) });
    list.sort((a, b) => a.y - b.y).forEach(i => i.f());
    if (this.fishing) {
      const bx = this.fishing.bx * TS - camX, by = this.fishing.by * TS - camY, bite = this.fishing.st === "bite";
      g.strokeStyle = "rgba(60,40,20,.7)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(m.x * TS - camX, m.y * TS - camY - TS * 0.5); g.lineTo(bx, by); g.stroke();
      const dip = bite ? TS * 0.15 : Math.sin(now / 300) * 2;
      g.fillStyle = "#e8493c"; g.beginPath(); g.arc(bx, by + dip, TS * 0.12, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by + dip - TS * 0.06, TS * 0.07, Math.PI, 0); g.fill();
      if (bite) { g.font = `${Math.round(TS * 0.7)}px Jua, sans-serif`; g.textAlign = "center"; g.lineWidth = 5; g.strokeStyle = "#24352a"; g.strokeText("쏙! 지금!", bx, by - TS * 0.5); g.fillStyle = "#fff"; g.fillText("쏙! 지금!", bx, by - TS * 0.5); }
    }
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    const dark = hr < 5 || hr >= 20 ? 0.25 : hr < 6.5 || hr >= 18.5 ? 0.12 : 0;
    if (dark) { g.fillStyle = `rgba(20,30,70,${dark})`; g.fillRect(0, 0, this.W, this.H); }
  }

  drawHouse() {
    const g = this.g, TS = this.TS, room = this.data.rooms[this.room], { ox, oy } = this.houseOrigin();
    const color = familyOf(this.houseMid).color;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#3a2d22"; g.fillRect(0, 0, this.W, this.H);
    for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
      const sx = ox + x * TS, sy = oy + y * TS;
      const isDoor = room.door.some(([a, b]) => a === x && b === y), isLink = (room.links || []).some(l => l.x === x && l.y === y);
      if (isLink) { g.fillStyle = "#6d4c30"; g.fillRect(sx, sy, TS + 1, TS + 1); g.fillStyle = "#a77b4f"; g.fillRect(sx + TS * 0.15, sy + TS * 0.1, TS * 0.7, TS * 0.9); continue; }
      if (y === 0 || x === 0 || x === room.w - 1 || (y === room.h - 1 && !isDoor)) {
        g.fillStyle = y === 0 ? "#efe2c6" : "#d6c19d"; g.fillRect(sx, sy, TS + 1, TS + 1);
        if (y === 0) { g.fillStyle = color; g.globalAlpha = 0.3; g.fillRect(sx, sy + TS * 0.62, TS + 1, TS * 0.12); g.globalAlpha = 1; }
      } else if (isDoor) { g.fillStyle = "#2a2018"; g.fillRect(sx, sy, TS + 1, TS + 1); }
      else { g.fillStyle = (x + y) % 2 ? "#c99e6e" : "#d4aa79"; g.fillRect(sx, sy, TS + 1, TS + 1); }
    }
    if (this.deco) { g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; for (let y = 1; y < room.h - 1; y++) for (let x = 1; x < room.w - 1; x++) g.strokeRect(ox + x * TS, oy + y * TS, TS, TS); }
    const list = [];
    if (this.room === "living") for (const [bx, by] of room.blocked) list.push({ y: by + 1, f: () => g.drawImage(SPR.bench, ox + bx * TS, oy + by * TS, TS, TS) });
    const p = this.housePlayer;
    if (p) for (const [id, f] of Object.entries(p.furn)) {
      if (f.state !== "placed" || f.room !== this.room) continue;
      const d = this.data.furniture[f.type]; if (!d) continue;
      const [w, h] = (f.rot || 0) % 2 ? [d.h, d.w] : [d.w, d.h];
      list.push({ y: f.y + h, f: () => {
        g.imageSmoothingEnabled = true;
        g.drawImage(furnArt(f.type, w, h, f.rot || 0), ox + f.x * TS, oy + f.y * TS, w * TS, h * TS);
        g.imageSmoothingEnabled = false;
        if (this.deco && this.deco.picked === id) { g.strokeStyle = "#ffd35c"; g.lineWidth = 3; g.strokeRect(ox + f.x * TS, oy + f.y * TS, w * TS, h * TS); }
      } });
    }
    for (const o of W.othersHere().values()) list.push({ y: o.y, f: () => this.drawPerson(o.m, ox + o.x * TS, oy + o.y * TS, o.d || 0, o.walk, o.moving) });
    list.push({ y: this.me.y, f: () => this.drawPerson(state.mid, ox + this.me.x * TS, oy + this.me.y * TS, this.me.dir, this.me.walk, this.me.moving) });
    list.sort((a, b) => a.y - b.y).forEach(i => i.f());
    g.font = `${Math.round(TS * 0.45)}px Jua, sans-serif`; g.textAlign = "center"; g.fillStyle = "#fffdf6";
    const owner = nameOf(this.houseMid);
    g.fillText(`${this.houseMid === state.mid ? "우리 집" : owner + "네 집"} · ${room.name}${this.houseMid === state.mid ? "" : " (구경 중)"}`, this.W / 2, oy - TS * 0.35);
  }

  drawJoy() {
    if (!this.joy) {
      // 조작 안내: 왼쪽 아래에 흐린 조이스틱 자리
      if (this.deco || this.fishing) return;
      const g = this.g, x = 90, y = this.H - 90;
      g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(x, y, 46, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(x, y, 20, 0, 7); g.fill();
      g.font = "14px Jua, sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.9)"; g.fillText("누르고 밀면 걸어요", x, y - 56);
      return;
    }
    const g = this.g, j = this.joy;
    g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(j.ox, j.oy, 46, 0, 7); g.fill();
    const d = Math.min(46, Math.hypot(j.dx, j.dy)), a = Math.atan2(j.dy, j.dx);
    g.fillStyle = "rgba(255,255,255,.65)"; g.beginPath(); g.arc(j.ox + Math.cos(a) * d, j.oy + Math.sin(a) * d, 20, 0, 7); g.fill();
  }
}
