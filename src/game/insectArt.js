// 곤충 그림(v3): 모양별로 코드로 그림. s = 1칸 크기, t = 초, ph = 개체마다 다른 위상
// 종 ID → 모양·색은 SHAPE 표. 모르는 종은 무당벌레 모양
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

export const SHAPE = {
  cabbage_white: ["butterfly", "#fbfbf5"], yellow_butterfly: ["butterfly", "#ffe066"], swallowtail: ["butterfly", "#f7a83a", true],
  red_dragonfly: ["dragonfly", "#e5452e"], cicada: ["cicada", "#6b5a3a"], ladybug: ["ladybug", "#e3463b"],
  stag_beetle: ["stag", "#5a3a22"], firefly: ["firefly", "#d9ff7a"], grasshopper: ["hopper", "#7fbf4a"],
  honeybee: ["bee", "#f2c230"], cricket: ["hopper", "#4a3a2a"], tiger_beetle: ["ladybug", "#2f8f6a"],
};

export function drawInsect(g, species, x, y, s, t, ph = 0) {
  const [kind, col, spots] = SHAPE[species] || ["ladybug", "#e3463b"];
  const u = s / 32;
  g.save(); g.translate(x, y); g.scale(u, u);
  if (kind === "butterfly") {
    const f = 0.25 + 0.75 * Math.abs(Math.sin(t * 8 + ph)); g.translate(0, Math.sin(t * 2 + ph) * 2);
    g.fillStyle = col; g.strokeStyle = "#3b3a2e"; g.lineWidth = 0.8;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 6 * f, -3, 6 * f, 5, sd * 0.3, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(sd * 4 * f, 4, 4 * f, 3.5, -sd * 0.3, 0, 7); g.fill(); g.stroke(); }
    if (spots) { g.fillStyle = "#3b3a2e"; g.fillRect(-7 * f, -4, 2, 2); g.fillRect(5 * f, -4, 2, 2); }
    g.fillStyle = "#3b3a2e"; rr(g, -1, -6, 2, 12, 1); g.fill();
  } else if (kind === "dragonfly") {
    const f = Math.sin(t * 30 + ph) * 0.3; g.fillStyle = "rgba(220,240,255,.8)";
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 8, -2 + f, 8, 2.5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(sd * 7, 2 - f, 7, 2.2, 0, 0, 7); g.fill(); }
    g.fillStyle = col; rr(g, -1.5, -6, 3, 18, 1.5); g.fill(); g.beginPath(); g.arc(0, -6, 2.5, 0, 7); g.fill();
  } else if (kind === "firefly") {
    const on = 0.5 + 0.5 * Math.sin(t * 3 + ph * 2), gl = g.createRadialGradient(0, 2, 0, 0, 2, 16);
    gl.addColorStop(0, `rgba(220,255,120,${on})`); gl.addColorStop(1, "rgba(220,255,120,0)"); g.fillStyle = gl; g.fillRect(-16, -14, 32, 32);
    g.fillStyle = "#3b3a2e"; rr(g, -2, -5, 4, 7, 2); g.fill(); g.fillStyle = `rgba(230,255,140,${0.5 + on / 2})`; g.beginPath(); g.arc(0, 3, 2.5, 0, 7); g.fill();
  } else if (kind === "ladybug") {
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.arc(0, -5, 3, 0, 7); g.fill(); g.fillRect(-0.5, -4, 1, 10);
    for (const [px, py] of [[-3, -1], [3, -1], [-2.5, 3], [2.5, 3], [0, 0.5]]) { g.beginPath(); g.arc(px, py, 1.1, 0, 7); g.fill(); }
  } else if (kind === "bee") {
    g.translate(Math.sin(t * 5 + ph) * 3, 0); g.fillStyle = "rgba(255,255,255,.85)";
    g.beginPath(); g.ellipse(-3, -5, 3, 4, -0.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(3, -5, 3, 4, 0.4, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 6, 4.5, 0, 0, 7); g.fill(); g.fillStyle = "#3b3a2e"; g.fillRect(-2, -4, 1.6, 8); g.fillRect(1.5, -4, 1.6, 8);
  } else if (kind === "stag") {
    g.fillStyle = col; rr(g, -4, -4, 8, 11, 3); g.fill(); g.beginPath(); g.arc(0, -5, 3.5, 0, 7); g.fill();
    g.strokeStyle = col; g.lineWidth = 1.8; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 2, -7); g.quadraticCurveTo(sd * 6, -11, sd * 2, -14); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(-0.4, -3, 0.8, 9);
  } else if (kind === "cicada") {
    g.fillStyle = "rgba(220,240,255,.65)"; g.beginPath(); g.ellipse(-4, 2, 3, 8, 0.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(4, 2, 3, 8, -0.2, 0, 7); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 5, 7, 0, 0, 7); g.fill();
  } else {   // hopper: 메뚜기·귀뚜라미
    g.translate(0, -Math.max(0, Math.sin(t * 2 + ph)) * 3);
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 7, 3, 0.2, 0, 7); g.fill();
    g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(3, 1); g.lineTo(8, -3); g.lineTo(10, 3); g.stroke();
  }
  g.restore();
}

// 잠자리채 휘두르기 효과: p = 0~1
export function drawNetSwing(g, x, y, s, p) {
  const u = s / 32;
  g.save(); g.translate(x, y); g.rotate(-0.8 + p * 1.6);
  g.strokeStyle = "#8a5a3a"; g.lineWidth = 2.5 * u; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -22 * u); g.stroke();
  g.strokeStyle = "#fff"; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(0, -30 * u, 8 * u, 0, 7); g.stroke();
  g.fillStyle = "rgba(255,255,255,.3)"; g.fill();
  g.restore();
}
