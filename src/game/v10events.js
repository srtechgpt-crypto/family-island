// 버전 10 이벤트 화면: 캠프 보물찾기(보물 상자·카운트다운·지도 힌트·결과) + 생일 잔치(풍선·고깔모자·주인공 선물)
import { state, onState } from "../state.js";
import { nameOf, josa, familyOf } from "../config/gameConfig.js";
import { serverNow, isConnected } from "../services/fb.js";
import * as EV from "../services/eventStore.js";
import * as P from "../services/playerStore.js";
import { HUNT, canStartAt, canStartAfter, huntPhase, validHunt, spotList, distToSpot, pickSpots, huntBonus, payKey, startAt, endAt, foundCount, huntResult } from "../domain/hunt.js";
import { birthdaysToday, recentBday, selfKey } from "../domain/bday.js";
import { WATER } from "./world.js";

const chestImg = new Image(); chestImg.src = "art/event/chest.png";
const BALLOON = ["#ff6b8a", "#ffd35c", "#6cc4ff", "#8ee07a", "#c99bff"];

export class EventLayer {
  constructor(game) {
    this.game = game;
    this.bonus = game.data.events.hunt.bonus;
    this.seenRun = new Set();     // 진행 중인 걸 본 판(끝나면 결과를 보여 줌)
    this.announced = new Set();
    this.opening = false;
    this.snaps = new Map();       // 판 id → 마지막으로 받은 모습(다음 판이 바로 와도 이전 결과를 보여 주려고)
    this.resultAt = null;         // { id, at } 결과를 보여 줄 시각(서버 확정을 잠깐 기다림)
    EV.watchHuntToday(); EV.watchCardsToday();
    onState(w => { if (w === "hunt") this.onHunt(); });
    setTimeout(() => this.selfGift(), 1500);
  }
  now() { return serverNow(); }
  hunt() { return validHunt(state.hunt) ? state.hunt : null; }
  phase() { return huntPhase(this.hunt(), this.now()); }
  active() { const p = this.phase(); return p === "count" || p === "run"; }

  // 새 판이 열렸다는 알림(집 안이어도)
  onHunt() {
    const h = this.hunt(); if (!h) return;
    // 이전 판 결과를 아직 못 보여 줬는데 새 판이 왔으면 이전 판 마지막 모습으로 보여 줌
    for (const id of [...this.seenRun]) if (id !== h.id && this.snaps.has(id)) { this.seenRun.delete(id); this.game.ui.showHuntResult(this.snaps.get(id)); }
    this.snaps.clear(); this.snaps.set(h.id, h);
    this.game.ui.refreshHuntResult(h);
    if (this.announced.has(h.id)) return;
    this.announced.add(h.id);
    if (this.active()) this.game.ui.toast(`💎 ${josa(nameOf(h.by), "이", "가")} 보물찾기를 열었어요!\n섬 곳곳에 보물 상자 10개가 숨겨져요`, 3200);
  }

  // ---- 시작 ----
  async start() {
    const g = this.game, now = this.now(), h = state.hunt;
    if (!isConnected()) return "인터넷 연결을 기다리는 중이에요";
    if (!g.camp.canUse()) return "가족 2명 이상이 모이고 불이 붙어 있을 때 할 수 있어요";
    if (!canStartAfter(validHunt(h) ? h : null, now)) return "지금 보물찾기를 하고 있어요!";
    if (!canStartAt(now)) return "밤 11시 55분이 넘어서 오늘은 끝! 내일 또 해요";
    if (g.houseL.move) return "집 옮기기를 먼저 끝내 주세요";
    const w = g.world, walk = (x, y) => w.walkable(x + 0.5, y + 0.5) && !WATER[w.tile(x, y)] && !w.inHouse(x, y);
    const spots = pickSpots(walk, w.w, w.h, g.data.campfire, Math.random);
    if (!spots) return "보물을 숨길 자리가 모자라요";
    const withMid = g.camp.atFire().find(m => m !== state.mid);   // 규칙이 이 가족도 캠프 옆에 있는지 확인
    if (!withMid) return "가족 2명 이상이 캠프에 모여 있어야 해요";
    const r = await g.camp.withPos(() => EV.startHunt(validHunt(h) ? h.n : 0, spots, withMid));
    return r.ok ? null : "보물찾기를 열지 못했어요. 가족이 먼저 열었는지 볼게요";
  }

  // ---- 행동 버튼 ----
  near() {
    const h = this.hunt(); if (!h || this.phase() !== "run" || this.game.mode !== "island") return null;
    const m = this.game.me; let best = null, bd = HUNT.openR;
    spotList(h).forEach((s, i) => { if (h.found && h.found[i]) return; const d = distToSpot(s, m.x, m.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  target() { const i = this.near(); return i === null ? null : { k: "treasure", i, label: "💎 열기" }; }
  async open(i) {
    const g = this.game, h = this.hunt(); if (!h || this.opening) return;
    if (!isConnected()) { g.ui.toast("인터넷 연결을 기다리는 중이에요"); return; }
    this.opening = true; g.ui.busy(true);
    try {
      const day = EV.huntDay(), reward = huntBonus(h.id, i, this.bonus);
      const res = await g.camp.withPos(() => EV.openTreasure(day, h.n, i, reward));
      if (res === "taken") { g.ui.toast("앗, 가족이 먼저 열었어요!"); return; }
      if (res !== "mine") { g.ui.toast("열지 못했어요. 상자 바로 옆에서 다시 눌러 봐요"); return; }
      const p = await P.payHuntTx(payKey(day, h.n, i), reward, g.data.items).catch(() => ({ ok: false }));
      if (!p.ok) { g.ui.toast("💎 보물을 찾았어요! 저장이 잠시 안 됐어요. 다시 들어오면 받아요", 3000); return; }
      EV.dropHuntMine(day, h.n, i);
      const it = g.data.items[reward.item] || { icon: "🎁", name: reward.item };
      g.ui.toast(`💎 보물을 찾았어요!\n보석 1개 + ${it.icon} ${it.name} ×${reward.qty}`, 2600);
    } finally { this.opening = false; g.ui.busy(false); }
  }

  // ---- 매 프레임 ----
  tick() {
    EV.watchHuntToday(); EV.watchCardsToday();
    const h = this.hunt(), ph = this.phase();
    if (h && (ph === "count" || ph === "run")) this.seenRun.add(h.id);
    // 끝: 연결돼 있을 때 1.5초 기다려(동시에 연 마지막 상자가 서버에서 확정되도록) 결과 — 그 사이 바뀌면 열린 결과 창도 다시 그림
    if (h && ph === "done" && this.seenRun.has(h.id) && isConnected() && !this.opening) {
      if (!this.resultAt || this.resultAt.id !== h.id) this.resultAt = { id: h.id, at: performance.now() + 1500 };
      else if (performance.now() >= this.resultAt.at) { this.seenRun.delete(h.id); this.resultAt = null; this.game.ui.showHuntResult(h); }
    }
    this.game.ui.setHuntGo(this.game.mode === "house" && this.active());
    const day = this.bdayDay(); if (day !== this._bd) { this._bd = day; this.game.ui.updateBday(); this.selfGift(); this.game.ui.refreshBday(true); }
  }
  // 오늘 생일 목록이 바뀌는지 보려고(날 바뀜·생일 저장)
  bdayDay() { return EV.cardsDay() + ":" + birthdaysToday(state.members, this.now()).join(","); }

  // 섬 그림: 보물 상자(찾는 중) + 생일 풍선
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1, t) {
    const h = this.hunt();
    if (h && this.phase() === "run") spotList(h).forEach((s, i) => {
      if ((h.found && h.found[i]) || s.x < x0 - 1 || s.x > x1 + 1 || s.y < y0 - 1 || s.y > y1 + 1) return;
      list.push({ y: s.y + 0.8, f: () => this.drawChest(g, s.x * TS - camX, s.y * TS - camY, TS, t + i) });
    });
    for (const b of this.balloonSpots()) if (b.x >= x0 - 1 && b.x <= x1 + 1 && b.y >= y0 - 2 && b.y <= y1 + 1)
      list.push({ y: b.y + 0.9, f: () => this.drawBalloons(g, b.x * TS - camX, b.y * TS - camY, TS, t + b.x) });
  }
  drawChest(g, px, py, TS, t) {
    const bob = Math.sin(t * 3) * TS * 0.05;
    g.fillStyle = "rgba(255,240,150,.35)"; g.beginPath(); g.ellipse(px + TS / 2, py + TS * 0.8, TS * 0.55, TS * 0.22, 0, 0, 7); g.fill();
    if (chestImg.complete && chestImg.naturalWidth) { const w = TS * 0.9, hh = w * chestImg.naturalHeight / chestImg.naturalWidth; g.drawImage(chestImg, px + (TS - w) / 2, py + TS * 0.85 - hh + bob, w, hh); }
    else { g.fillStyle = "#a8682f"; g.fillRect(px + TS * 0.12, py + TS * 0.3 + bob, TS * 0.76, TS * 0.5); g.fillStyle = "#ffd35c"; g.fillRect(px + TS * 0.12, py + TS * 0.45 + bob, TS * 0.76, TS * 0.06); }
    // 반짝이
    const k = (Math.sin(t * 5) + 1) / 2; g.fillStyle = `rgba(255,255,255,${0.4 + k * 0.6})`;
    const sx = px + TS * (0.2 + 0.6 * ((Math.floor(t) * 7) % 10) / 10), sy = py + TS * 0.15 + bob, r = TS * (0.06 + k * 0.06);
    g.beginPath(); g.moveTo(sx, sy - r * 2); g.lineTo(sx + r * 0.5, sy - r * 0.5); g.lineTo(sx + r * 2, sy); g.lineTo(sx + r * 0.5, sy + r * 0.5); g.lineTo(sx, sy + r * 2); g.lineTo(sx - r * 0.5, sy + r * 0.5); g.lineTo(sx - r * 2, sy); g.lineTo(sx - r * 0.5, sy - r * 0.5); g.closePath(); g.fill();
  }
  // 생일 풍선 자리: 캠프 광장 네 귀퉁이 + 주인공 집 문 양옆
  balloonSpots() {
    const who = birthdaysToday(state.members, this.now()); if (!who.length) return [];
    const p = this.game.data.campfire.plaza, out = [{ x: p.x - 1, y: p.y - 1 }, { x: p.x + p.w, y: p.y - 1 }, { x: p.x - 1, y: p.y + p.h }, { x: p.x + p.w, y: p.y + p.h }];
    for (const m of who) { const h = this.game.world.houseOf(m); if (h) out.push({ x: h.door.x - 1, y: h.door.y + 1, m }, { x: h.door.x + 1, y: h.door.y + 1, m }); }
    return out;
  }
  drawBalloons(g, px, py, TS, t) {
    const bx = px + TS / 2, by = py + TS * 0.9;
    g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(bx, by, TS * 0.18, TS * 0.07, 0, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.45 + Math.sin(t * 1.6 + i) * 0.08, L = TS * (1.25 + (i % 2) * 0.25);
      const hx = bx + Math.sin(a) * L, hy = by - Math.cos(a) * L;
      g.strokeStyle = "rgba(80,60,40,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.sin(a) * L * 0.4 + 3, by - L * 0.5, hx, hy + TS * 0.22); g.stroke();
      g.fillStyle = BALLOON[(i + Math.floor(px / TS)) % BALLOON.length]; g.beginPath(); g.ellipse(hx, hy, TS * 0.22, TS * 0.27, 0, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(hx - TS * 0.07, hy - TS * 0.09, TS * 0.05, TS * 0.08, 0, 0, 7); g.fill();
    }
  }
  // 고깔모자: 오늘 생일인 사람 머리 위. 돌려주는 값 = 모자 높이(이름표를 그만큼 올림)
  hatOn(mid) { return birthdaysToday(state.members, this.now()).includes(mid); }
  drawHat(g, x, headTop, TS, mid) {
    const h = TS * 0.55, w = TS * 0.38, c = (familyOf(mid) || {}).color || "#ff6b8a";
    g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, headTop + TS * 0.08); g.lineTo(x + w / 2, headTop + TS * 0.08); g.lineTo(x, headTop + TS * 0.08 - h); g.closePath(); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.5, TS * 0.05);
    for (const k of [0.35, 0.65]) { g.beginPath(); g.moveTo(x - w / 2 * (1 - k), headTop + TS * 0.08 - h * k); g.lineTo(x + w / 2 * (1 - k), headTop + TS * 0.08 - h * k); g.stroke(); }
    g.fillStyle = "#ffd35c"; g.beginPath(); g.arc(x, headTop + TS * 0.08 - h, TS * 0.08, 0, 7); g.fill();
    return h;
  }

  // 화면 위 띠: 카운트다운 / 찾는 중(집 안에서도)
  drawOverlay(g) {
    const h = this.hunt(), ph = this.phase(), now = this.now(); if (!h || (ph !== "count" && ph !== "run")) return;
    const W = this.game.W;
    const text = ph === "count" ? `💎 보물찾기 ${Math.max(1, Math.ceil((startAt(h) - now) / 1000))}초 뒤 시작!`
      : `💎 찾은 보물 ${foundCount(h)}/${HUNT.count} · 남은 시간 ${fmt(endAt(h) - now)}` + (isConnected() ? "" : " (연결 끊김)");
    const big = ph === "count", fs = big ? 24 : 17;
    g.font = `${fs}px Jua, sans-serif`; g.textAlign = "center";
    const tw = g.measureText(text).width + 30, y = big ? this.game.H * 0.72 : 88, x = W / 2;   // 세기는 아래쪽(알림 창과 겹치지 않게)
    g.fillStyle = big ? "rgba(60,30,90,.85)" : "rgba(42,32,24,.78)"; g.beginPath(); g.roundRect(x - tw / 2, y - fs - 6, tw, fs + 18, 14); g.fill();
    g.fillStyle = "#fff6c9"; g.fillText(text, x, y + 2);
  }
  // 지도 힌트: 찾기 시작 1분 뒤부터 남은 보물에 반짝이(작은 지도·큰 지도)
  drawMapHints(g, x, y, w, h, big) {
    const hu = this.hunt(); if (!hu || this.phase() !== "run" || this.now() - startAt(hu) < HUNT.hintAfterMs) return;
    const wd = this.game.world, sc = Math.min(w / wd.w, h / wd.h), ox = x + (w - wd.w * sc) / 2, oy = y + (h - wd.h * sc) / 2;
    const k = (Math.sin(performance.now() / 250) + 1) / 2;
    spotList(hu).forEach((s, i) => {
      if (hu.found && hu.found[i]) return;
      const px = ox + (s.x + 0.5) * sc, py = oy + (s.y + 0.5) * sc, r = (big ? 5 : 2.6) * (0.8 + k * 0.4);
      g.fillStyle = "#fff36b"; g.strokeStyle = "#a8682f"; g.lineWidth = big ? 1.5 : 1;
      g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    });
  }

  // ---- 생일: 주인공 몫(생일~7일 안 첫 입장 때 자동) ----
  async selfGift() {
    const b = state.members[state.mid] && state.members[state.mid].bday, day = recentBday(b, this.now());
    if (day === null || !state.player || (state.player.done && state.player.done[selfKey(day)])) return;
    const r = await P.selfGiftTx(day).catch(() => ({ ok: false }));
    if (r.ok && r.changed !== false) this.game.ui.toast("🎂 생일 축하해요!\n생일 케이크 장식과 풍선 다발을 받았어요(꾸미기 보관함)", 3500);
  }
}
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export { huntResult };
