// 버전 4 섬 꾸밈과 뱃놀이: 채집 밭 바닥, 목장(준비 중) 울타리·표지판, 나루터, 배 타기·내리기, 캠프 저녁 하늘
import { state } from "../state.js";
import { boatMove, canBoard, disembarkSpot } from "../domain/boating.js";

const SOIL = { weeds: "#7fae4f", mushrooms: "#6b5a3e", herbs: "#5e9e74", flowers: "#a7c46a", stones: "#a39a8a" };

export class LakeLayer {
  constructor(game) {
    this.game = game;
    this.map = game.world.map;
    this.lake = game.data.lake || null;
    this.docks = this.map.docks || [];
    this.fields = (game.data.gatheringFields && game.data.gatheringFields.fields) || [];
    this.ranch = this.map.ranch || null;
    this.boating = false;
    this.evening = 0;          // 0~1, 저녁 하늘 진하기(부드럽게 바뀜)
  }

  // ---------- 배 ----------
  dockNear() { return this.lake ? canBoard(this.map, this.docks, { x: this.game.me.x, y: this.game.me.y }) : null; }
  target() {
    if (this.game.mode !== "island" || !this.lake) return null;
    const d = this.dockNear();
    if (!this.boating && d) return { k: "boatOn", dock: d, label: "배 타기" };
    if (this.boating && d) return { k: "boatOff", dock: d, label: "내리기" };
    return null;
  }
  board(dock) {
    const m = this.game.me;
    m.x = dock.boat.x + 0.5; m.y = dock.boat.y + 0.5; m.dir = dock.boat.y < dock.y ? 3 : dock.boat.x < dock.x ? 1 : 2;
    this.boating = true;
    this.game.sendPosNow().catch(() => {});
    this.game.ui.toast("🚣 배를 탔어요! 왼쪽을 밀면 노를 저어요");
  }
  leave(dock) {
    const occupied = new Set([...this.game.othersHereList()].map(o => Math.floor(o.x) + "," + Math.floor(o.y)));
    const spot = disembarkSpot(this.map, dock, occupied);
    if (!spot) { this.game.ui.toast("나루터가 붐벼요. 잠시 뒤에 내려요"); return; }
    const m = this.game.me; m.x = spot.x + 0.5; m.y = spot.y + 0.5;
    this.boating = false;
    this.game.sendPosNow().catch(() => {});
  }
  // 연결이 끊겼다 다시 붙으면 육지(나루터)에서 다시 시작
  reset() { if (this.boating) { this.boating = false; const d = this.docks[0]; if (d) { this.game.me.x = d.x + 0.5; this.game.me.y = d.y + 0.5; } } }
  move(mx, my, dt) {
    const m = this.game.me;
    const p = boatMove(this.map, this.lake, { x: m.x, y: m.y }, mx, my, dt, 3.4);
    m.x = p.x; m.y = p.y;
  }

  // ---------- 그리기 ----------
  // 바닥 꾸밈: 물건·사람보다 먼저 그리도록 아주 작은 y로 넣는다
  addGround(list, g, TS, camX, camY, x0, y0, x1, y1) {
    const vis = r => r.x + r.w >= x0 && r.x <= x1 && r.y + r.h >= y0 && r.y <= y1;
    for (const f of this.fields) if (vis(f.rect)) list.push({ y: -1e6, f: () => this.drawField(g, f, TS, camX, camY) });
    if (this.ranch && vis(this.ranch)) list.push({ y: -1e6, f: () => this.drawRanch(g, TS, camX, camY) });
    for (const d of this.docks) if (d.x >= x0 - 2 && d.x <= x1 + 2 && d.y >= y0 - 2 && d.y <= y1 + 2) list.push({ y: d.y + 0.1, f: () => this.drawDock(g, d, TS, camX, camY) });
  }
  drawField(g, f, TS, camX, camY) {
    const r = f.rect, x = r.x * TS - camX, y = r.y * TS - camY;
    g.save();
    g.fillStyle = SOIL[f.id] || "#8fb85a"; g.globalAlpha = 0.55;
    g.beginPath(); g.roundRect(x - TS * 0.2, y - TS * 0.2, r.w * TS + TS * 0.4, r.h * TS + TS * 0.4, TS * 0.6); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(255,255,255,.55)"; g.setLineDash([TS * 0.25, TS * 0.2]); g.lineWidth = Math.max(1.5, TS * 0.06); g.stroke(); g.setLineDash([]);
    this.sign(g, x + r.w * TS / 2, y - TS * 0.35, f.name, TS);
    g.restore();
  }
  drawRanch(g, TS, camX, camY) {
    const r = this.ranch, x = r.x * TS - camX, y = r.y * TS - camY, w = r.w * TS, h = r.h * TS;
    g.save();
    g.strokeStyle = "#a77b4f"; g.lineWidth = Math.max(2, TS * 0.1);
    for (const off of [0.25, 0.55]) {                                   // 울타리 가로대 두 줄
      g.beginPath(); g.rect(x + TS * 0.3, y + TS * off, w - TS * 0.6, h - TS * 0.6); g.stroke();
    }
    g.fillStyle = "#8a5f3a";
    for (let i = 0; i <= r.w; i += 2) for (const yy of [y + TS * 0.05, y + h - TS * 0.55]) g.fillRect(x + i * TS - TS * 0.08 + TS * 0.3 * (i === 0 ? 1 : i === r.w ? -1 : 0), yy, TS * 0.16, TS * 0.5);
    for (let j = 0; j <= r.h; j += 2) for (const xx of [x + TS * 0.22, x + w - TS * 0.38]) g.fillRect(xx, y + j * TS - TS * 0.25 + TS * 0.3 * (j === 0 ? 1 : j === r.h ? -1 : 0), TS * 0.16, TS * 0.5);
    this.sign(g, x + (96.5 - r.x) * TS, y + h - TS * 0.7, "🐔 목장", TS * 1.1);
    g.restore();
  }
  sign(g, cx, cy, text, TS) {
    g.font = `${Math.round(TS * 0.42)}px Jua, sans-serif`; g.textAlign = "center";
    const tw = g.measureText(text).width + TS * 0.5, th = TS * 0.6;
    g.fillStyle = "#8a5f3a"; g.fillRect(cx - TS * 0.06, cy, TS * 0.12, TS * 0.5);
    g.fillStyle = "#e9c48f"; g.strokeStyle = "#7a4f2b"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(cx - tw / 2, cy - th, tw, th, TS * 0.12); g.fill(); g.stroke();
    g.fillStyle = "#4f2f19"; g.fillText(text, cx, cy - th * 0.28);
  }
  drawDock(g, d, TS, camX, camY) {
    const x = d.x * TS - camX, y = d.y * TS - camY, bx = d.boat.x * TS - camX, by = d.boat.y * TS - camY;
    g.save();
    const x0 = Math.min(x, bx), y0 = Math.min(y, by), w = Math.abs(bx - x) + TS, h = Math.abs(by - y) + TS;
    g.fillStyle = "#b9875a"; g.fillRect(x0 + TS * 0.12, y0 + TS * 0.12, w - TS * 0.24, h - TS * 0.24);
    g.strokeStyle = "rgba(79,47,25,.55)"; g.lineWidth = 1.2;
    const vert = d.boat.x === d.x;
    for (let i = 1; i < (vert ? h : w) / (TS * 0.25); i++) {
      g.beginPath();
      if (vert) { g.moveTo(x0 + TS * 0.12, y0 + i * TS * 0.25); g.lineTo(x0 + w - TS * 0.12, y0 + i * TS * 0.25); }
      else { g.moveTo(x0 + i * TS * 0.25, y0 + TS * 0.12); g.lineTo(x0 + i * TS * 0.25, y0 + h - TS * 0.12); }
      g.stroke();
    }
    if (!this.boatAtDockTaken(d)) this.drawBoatShape(g, bx + TS / 2, by + TS / 2, TS, vert ? 3 : 1, 0, 0.75);
    this.sign(g, x + TS / 2, y - TS * 0.1, "나루터", TS * 0.9);
    g.restore();
  }
  boatAtDockTaken() { return false; }
  // 배 모양(사람 밑에 깔림). dir: 0 아래 1 왼 2 오 3 위
  drawBoatShape(g, cx, cy, TS, dir, t, alpha = 1) {
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy + TS * 0.25 + Math.sin(t * 2.2) * TS * 0.03);
    if (dir === 0 || dir === 3) g.rotate(Math.PI / 2);
    const L = TS * 0.95, B = TS * 0.42;
    g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(0, B * 0.55, L * 1.05, B * 0.45, 0, 0, 7); g.fill();   // 물결
    g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(-L * 0.6, B, 0, B); g.quadraticCurveTo(L * 0.6, B, L, 0);
    g.quadraticCurveTo(L * 0.6, -B * 0.55, 0, -B * 0.55); g.quadraticCurveTo(-L * 0.6, -B * 0.55, -L, 0); g.closePath();
    g.fillStyle = "#c58b55"; g.fill(); g.lineWidth = Math.max(1.5, TS * 0.05); g.strokeStyle = "#6e4325"; g.stroke();
    g.fillStyle = "#e6b77d"; g.beginPath(); g.ellipse(0, -B * 0.05, L * 0.72, B * 0.42, 0, 0, 7); g.fill();
    g.fillStyle = "#9c6438"; g.fillRect(-TS * 0.05, -B * 0.45, TS * 0.1, B * 0.8);            // 가운데 가로 판
    g.strokeStyle = "#7a4f2b"; g.lineWidth = Math.max(1.2, TS * 0.04);                          // 노
    g.beginPath(); g.moveTo(-TS * 0.1, -B * 0.2); g.lineTo(-TS * 0.35, -B * 1.3); g.stroke();
    g.beginPath(); g.moveTo(TS * 0.1, -B * 0.2); g.lineTo(TS * 0.35, -B * 1.3); g.stroke();
    g.restore();
  }

  // 캠프 저녁 하늘: evening이 참이면 1초에 걸쳐 어두워지고 별이 뜸
  drawEvening(g, W, H, on, dt, t) {
    this.evening += ((on ? 1 : 0) - this.evening) * Math.min(1, dt * 2.5);
    const e = this.evening; if (e < 0.01) return;
    g.save();
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(25,22,70,${0.55 * e})`); gr.addColorStop(0.6, `rgba(70,40,90,${0.42 * e})`); gr.addColorStop(1, `rgba(150,70,60,${0.3 * e})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = `rgba(255,250,220,${0.85 * e})`;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97.3) % W, y = ((i * 53.7) % (H * 0.45)), tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
      g.globalAlpha = e * tw; g.beginPath(); g.arc(x, y, 1 + (i % 3) * 0.5, 0, 7); g.fill();
    }
    g.restore();
  }
}
