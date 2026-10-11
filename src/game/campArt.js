// 캠프파이어 그림(v3): 돌·장작, 불꽃(크기 조절), 불티, 빛, 불꽃놀이 입자. 시제품과 같은 그림
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

export class CampFx {
  constructor() { this.sparks = []; this.fw = []; this.firedId = null; }

  // 바닥 빛(사람·물건 아래에 먼저 그림). s = 1칸 크기, scale = fireScale(n)
  drawGlow(g, cx, cy, s, scale, night) {
    const r = s * (2.2 + scale * 1.6) * (night ? 1.25 : 0.8);
    const gl = g.createRadialGradient(cx, cy, s * 0.2, cx, cy, r);
    gl.addColorStop(0, `rgba(255,190,90,${night ? 0.5 : 0.25})`); gl.addColorStop(1, "rgba(255,190,90,0)");
    g.fillStyle = gl; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // 장작+불. lit=false면 꺼진 장작만
  drawFire(g, cx, cy, s, lit, scale, t, dt) {
    const u = s / 28;   // 캐릭터 옆에서도 잘 보이게 조금 크게
    g.fillStyle = "rgba(40,25,10,.25)"; g.beginPath(); g.ellipse(cx, cy + 6 * u, 36 * u, 11 * u, 0, 0, 7); g.fill();
    g.fillStyle = "#8d8f94";
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * 30 * u, cy + 4 * u + Math.sin(a) * 9 * u, 6 * u, 4 * u, 0, 0, 7); g.fill(); }
    for (const [ang, col] of [[0.35, "#7a4e2c"], [-0.35, "#8a5a3a"], [0, "#6e4325"]]) {
      g.save(); g.translate(cx, cy + 2 * u); g.rotate(ang); rr(g, -24 * u, -4 * u, 48 * u, 8 * u, 4 * u); g.fillStyle = lit ? col : "#5a4636"; g.fill();
      g.fillStyle = lit ? "#e8c08c" : "#9a8a78"; g.beginPath(); g.arc(22 * u, 0, 3.5 * u, 0, 7); g.fill(); g.restore();
    }
    if (!lit) { g.fillStyle = "rgba(60,60,60,.35)"; g.beginPath(); g.ellipse(cx, cy, 14 * u, 5 * u, 0, 0, 7); g.fill(); return; }
    const k = scale;
    for (const [col, sc] of [["#e8452e", 1], ["#f7941d", 0.72], ["#ffe066", 0.42]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(cx - 22 * k * sc * u, cy);
      for (let i = 0; i <= 6; i++) {
        const x = cx - 22 * k * sc * u + i * (44 * k * sc * u / 6), h = (i % 2 ? 46 : 26) * k * sc * u * (1 + 0.18 * Math.sin(t * 9 + i * 1.7));
        g.quadraticCurveTo(x - 4 * u, cy - h * 0.6, x, cy - h);
      }
      g.lineTo(cx + 22 * k * sc * u, cy); g.closePath(); g.fill();
    }
    if (this.sparks.length < 40 && Math.random() < 0.3 * k) this.sparks.push({ x: cx + (Math.random() - 0.5) * 20 * u, y: cy - 30 * k * u, vy: (-30 - Math.random() * 30) * u, life: 1 });
    this.sparks = this.sparks.filter(p => (p.life -= dt) > 0);
    for (const p of this.sparks) { p.y += p.vy * dt; g.fillStyle = `rgba(255,220,120,${p.life})`; g.fillRect(p.x + Math.sin(p.y / u) * 3 * u, p.y, 2 * u, 2 * u); }
  }

  // 마시멜로 꼬챙이: p = 0~1 익은 정도
  drawStick(g, cx, cy, s, p) {
    const u = s / 28, col = p < 0.55 ? "#fffaf0" : p < 0.8 ? "#e9b56a" : "#4a3a2a";
    g.strokeStyle = "#8a5a3a"; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(cx + 70 * u, cy - 60 * u); g.lineTo(cx + 8 * u, cy - 34 * u); g.stroke();
    rr(g, cx - 2 * u, cy - 42 * u, 14 * u, 12 * u, 4 * u); g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = u; g.stroke();
  }

  // 불꽃놀이(같은 id는 한 번만). (x0,y0,w,h) = 화면 위쪽 영역
  fireworks(id, x0, y0, w, h, colors) {
    if (!id || this.firedId === id) return;
    this.firedId = id;
    for (let k = 0; k < 6; k++) setTimeout(() => {
      const x = x0 + w * (0.15 + Math.random() * 0.7), y = y0 + h * (0.15 + Math.random() * 0.4), col = colors[k % colors.length];
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, v = (60 + Math.random() * 50); this.fw.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.5, col }); }
    }, k * 420);
  }
  drawFireworks(g, dt) {
    if (!this.fw.length) return;
    this.fw = this.fw.filter(f => (f.life -= dt) > 0);
    for (const f of this.fw) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 40 * dt; g.globalAlpha = Math.min(1, f.life); g.fillStyle = f.col; g.fillRect(f.x, f.y, 3, 3); }
    g.globalAlpha = 1;
  }
}
