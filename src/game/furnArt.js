// 가구 그림(코드로 그림): 칸당 32단위로 그려서 1.5배(48px) 캔버스에 담는다. rot 0~3 = 방향
const U = 32, K = 1.5;
const cache = new Map();

const WOOD = { hi: "#e6b77d", mid: "#c58b55", lo: "#9c6438", dk: "#6e4325", line: "#4f2f19" };

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fillStroke(g, fill, stroke = WOOD.line, lw = 1.2) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
function shadow(g, cx, cy, rx, ry) { g.fillStyle = "rgba(40,25,10,.22)"; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function woodGrad(g, x0, y0, x1, y1, a = WOOD.hi, b = WOOD.mid) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
function grain(g, x, y, w, h, n) {
  g.strokeStyle = "rgba(110,67,37,.28)"; g.lineWidth = 0.7;
  for (let i = 1; i <= n; i++) { const yy = y + (h * i) / (n + 1); g.beginPath(); g.moveTo(x + 2, yy); g.bezierCurveTo(x + w * 0.3, yy - 1.2, x + w * 0.6, yy + 1.2, x + w - 2, yy); g.stroke(); }
}

// ---- 나무 탁자: 위판 + 앞면 두께 + 다리 4개 + 가운데 천 ----
function table(g, W, H) {
  shadow(g, W / 2, H - 3, W / 2 - 3, 3.5);
  const top = 3, edge = 5, bottom = H - 11;
  g.fillStyle = WOOD.dk;
  for (const x of [5, W - 9]) { rr(g, x, bottom, 4, 9, 1.5); g.fill(); }
  rr(g, 2, top, W - 4, bottom - top, 4); fillStroke(g, woodGrad(g, 0, top, 0, bottom));
  grain(g, 2, top, W - 4, bottom - top - edge, Math.max(2, Math.round(H / 12)));
  rr(g, 2, bottom - edge, W - 4, edge, [0, 0, 4, 4]); fillStroke(g, WOOD.lo);
  g.fillStyle = "rgba(255,255,255,.35)"; rr(g, 5, top + 1.5, W - 10, 1.6, 1); g.fill();
  // 천 + 작은 꽃병
  const cw = Math.min(W, H) * 0.55, cx = W / 2, cy = (top + bottom - edge) / 2;
  g.save(); g.translate(cx, cy); g.rotate(0.1);
  rr(g, -cw / 2, -cw / 3, cw, cw / 1.5, 2); fillStroke(g, "#fff6e8", "#e0c9a8", 0.8);
  g.strokeStyle = "#e88a9a"; g.setLineDash([1.5, 1.5]); rr(g, -cw / 2 + 2, -cw / 3 + 2, cw - 4, cw / 1.5 - 4, 1.5); g.stroke(); g.setLineDash([]);
  g.restore();
  g.fillStyle = "#7fb7d8"; rr(g, cx - 2.5, cy - 5, 5, 6, 2); g.fill(); g.strokeStyle = "#4d7f9e"; g.lineWidth = 0.8; g.stroke();
  for (const [dx, dy, c] of [[-2.5, -7, "#ff7d95"], [2, -8, "#ffd35c"], [0, -9.5, "#ff9fb1"]]) { g.fillStyle = c; g.beginPath(); g.arc(cx + dx, cy + dy, 2, 0, 7); g.fill(); }
}

// ---- 나무 의자: rot 0 앞(등받이 위) / 1 오른쪽 등받이 / 2 뒤 / 3 왼쪽 ----
function chair(g, rot) {
  shadow(g, 16, 29, 11, 2.5);
  const legs = xs => { g.fillStyle = WOOD.dk; for (const x of xs) { rr(g, x, 21, 3, 8, 1); g.fill(); } };
  const seat = (x, y, w, h) => {
    rr(g, x, y, w, h, 3); fillStroke(g, woodGrad(g, 0, y, 0, y + h));
    rr(g, x, y + h - 3, w, 3, [0, 0, 3, 3]); fillStroke(g, WOOD.lo);
    g.fillStyle = "#e88a9a"; rr(g, x + 3, y + 2, w - 6, h - 7, 3); g.fill(); // 방석
    g.fillStyle = "rgba(255,255,255,.35)"; rr(g, x + 5, y + 3, w - 12, 1.5, 1); g.fill();
  };
  const backFront = (x, y, w, h) => {
    rr(g, x, y, w, h, [4, 4, 1, 1]); fillStroke(g, woodGrad(g, 0, y, 0, y + h, WOOD.mid, WOOD.lo));
    g.fillStyle = "rgba(60,35,18,.45)";
    for (let i = 1; i < 3; i++) { rr(g, x + (w * i) / 3 - 1, y + 4, 2, h - 6, 1); g.fill(); }
    g.fillStyle = "rgba(255,255,255,.3)"; rr(g, x + 3, y + 1.5, w - 6, 1.4, 1); g.fill();
  };
  if (rot === 0) { legs([7, 22]); seat(5, 12, 22, 12); backFront(7, 2, 18, 12); }
  else if (rot === 2) { legs([7, 22]); seat(5, 8, 22, 12); backFront(7, 15, 18, 11); }
  else {
    const flip = rot === 3;
    g.save(); if (flip) { g.translate(32, 0); g.scale(-1, 1); }
    legs([6, 18]); seat(4, 12, 19, 12);
    rr(g, 21, 3, 6, 23, 2.5); fillStroke(g, woodGrad(g, 21, 0, 27, 0, WOOD.mid, WOOD.lo));
    g.fillStyle = "rgba(255,255,255,.3)"; rr(g, 22.2, 5, 1.4, 18, 1); g.fill();
    g.restore();
  }
}

// ---- 꽃 화분 ----
function pot(g) {
  shadow(g, 16, 29, 9, 2.5);
  g.strokeStyle = "#3f8a3a"; g.lineWidth = 1.4;
  for (const [x1, y1] of [[9, 9], [16, 5], [23, 9], [12, 13], [20, 12]]) { g.beginPath(); g.moveTo(16, 19); g.quadraticCurveTo((16 + x1) / 2, 14, x1, y1); g.stroke(); }
  const leaf = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 4.5, 2, 0, 0, 7); fillStroke(g, "#5fb35a", "#3a7d36", 0.8); g.restore(); };
  leaf(10, 15, -0.6); leaf(22, 15, 0.6); leaf(13, 11, -1.1); leaf(20, 10, 1.0);
  const flower = (x, y, c) => {
    g.fillStyle = c; for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 2.3, y + Math.sin(a) * 2.3, 1.9, 0, 7); g.fill(); }
    g.fillStyle = "#ffd35c"; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
  };
  flower(9, 8, "#ff7d95"); flower(16, 4.5, "#ff9fb1"); flower(23, 8, "#ff7d95"); flower(13, 12.5, "#fff"); flower(20, 11.5, "#ffb3c1");
  g.beginPath(); g.moveTo(8, 20); g.lineTo(24, 20); g.lineTo(21.5, 29); g.lineTo(10.5, 29); g.closePath();
  fillStroke(g, woodGrad(g, 8, 0, 24, 0, "#e08a5c", "#b85d35"), "#7a3a1c");
  rr(g, 6.5, 18, 19, 4, 1.5); fillStroke(g, "#d9774a", "#7a3a1c");
  g.fillStyle = "rgba(255,255,255,.3)"; rr(g, 8, 18.8, 8, 1.2, 1); g.fill();
}

// ---- 조개 램프: 빛 + 받침 + 기둥 + 가리비 갓 ----
function lamp(g) {
  const glow = g.createRadialGradient(16, 11, 1, 16, 11, 16);
  glow.addColorStop(0, "rgba(255,236,160,.75)"); glow.addColorStop(1, "rgba(255,236,160,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 32, 32);
  shadow(g, 16, 29, 7, 2);
  rr(g, 10, 25, 12, 4, 2); fillStroke(g, woodGrad(g, 0, 25, 0, 29));
  g.fillStyle = WOOD.dk; rr(g, 15, 15, 2, 11, 1); g.fill();
  // 가리비 모양 갓
  g.beginPath(); g.moveTo(16, 17);
  for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI, r = 11; const x = 16 + Math.cos(a) * r, y = 15 + Math.sin(a) * r * 0.85; g.lineTo(x, y); }
  g.closePath(); fillStroke(g, woodGrad(g, 0, 4, 0, 17, "#fff1e6", "#f6c9b4"), "#c98a74", 1);
  g.strokeStyle = "#e3a58f"; g.lineWidth = 0.8;
  for (let i = 1; i < 6; i++) { const a = Math.PI + (i / 6) * Math.PI; g.beginPath(); g.moveTo(16, 16); g.lineTo(16 + Math.cos(a) * 10, 15 + Math.sin(a) * 8.5); g.stroke(); }
  rr(g, 13, 15.5, 6, 2.5, 1); fillStroke(g, "#f6c9b4", "#c98a74", 0.8);
}

// ---- 통나무 침대(정사각 2x2): rot만큼 돌림, 0 = 머리판 위 ----
function bed(g, S) {
  g.save(); g.translate(S / 2, S / 2); g.rotate((bed.rot || 0) * Math.PI / 2); g.translate(-S / 2, -S / 2);
  shadow(g, S / 2, S - 3, S / 2 - 3, 3);
  const log = (x, y, w, h, vertical) => {
    rr(g, x, y, w, h, Math.min(w, h) / 2);
    fillStroke(g, vertical ? woodGrad(g, x, 0, x + w, 0, WOOD.hi, WOOD.lo) : woodGrad(g, 0, y, 0, y + h, WOOD.hi, WOOD.lo));
    g.strokeStyle = "rgba(79,47,25,.35)"; g.lineWidth = 0.7;
    if (!vertical) for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, y + 1.5); g.lineTo(x + (w * i) / 4 + 1.5, y + h - 1.5); g.stroke(); }
  };
  const ring = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); fillStroke(g, "#e8c08c"); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.strokeStyle = "#a8743f"; g.lineWidth = 0.7; g.stroke(); };
  log(4, 9, 4.5, S - 13, true); log(S - 8.5, 9, 4.5, S - 13, true);           // 옆 통나무
  rr(g, 7, 10, S - 14, S - 15, 3); fillStroke(g, "#fbf7ef", "#cbbfa9");      // 매트리스
  // 이불(아래 60%) + 체크무늬
  const by = S * 0.42;
  rr(g, 6, by, S - 12, S - by - 5, [4, 4, 3, 3]); fillStroke(g, "#7fb7d8", "#4d7f9e");
  g.fillStyle = "rgba(255,255,255,.28)";
  for (let x = 9; x < S - 9; x += 7) g.fillRect(x, by + 1, 2.5, S - by - 7);
  for (let y = by + 4; y < S - 7; y += 7) g.fillRect(7, y, S - 14, 2.5);
  rr(g, 6, by, S - 12, 4.5, [4, 4, 0, 0]); fillStroke(g, "#fff6e8", "#d9c8ac", 0.8); // 접힌 시트
  // 베개
  rr(g, S / 2 - 12, 11.5, 24, 9, 4.5); fillStroke(g, "#fffaf2", "#d6c7ae");
  g.strokeStyle = "rgba(200,180,150,.6)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(S / 2 - 7, 16); g.lineTo(S / 2 + 7, 16); g.stroke();
  log(2, 2, S - 4, 9, false); ring(5.5, 6.5, 3.6); ring(S - 5.5, 6.5, 3.6);     // 머리판
  log(3, S - 8, S - 6, 6, false);                                               // 발판
  g.restore();
}

// ---- 나무 책장: 틀 + 칸 + 색색 책(위치마다 같은 모양) ----
function shelf(g, W, H) {
  shadow(g, W / 2, H - 2.5, W / 2 - 2, 2.5);
  rr(g, 2, 2, W - 4, H - 5, 3); fillStroke(g, woodGrad(g, 0, 0, W, 0, WOOD.mid, WOOD.lo));
  const rows = Math.max(2, Math.round((H - 8) / 15)), ih = (H - 11) / rows;
  const COLS = ["#e3463b", "#5aa0d0", "#ffd35c", "#6fbf73", "#b48ad6", "#f39a2b", "#f4f0ff", "#e88a9a"];
  let seed = W * 31 + H * 17;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let r = 0; r < rows; r++) {
    const y = 5 + r * ih;
    g.fillStyle = "#5a3620"; g.fillRect(5, y, W - 10, ih - 2.5);              // 칸 안쪽
    let x = 6;
    while (x < W - 9) {
      const bw = 2.5 + rnd() * 2.5, bh = (ih - 4) * (0.65 + rnd() * 0.3);
      if (rnd() < 0.12 && x < W - 14) { x += 3; continue; }                     // 빈틈
      g.fillStyle = COLS[Math.floor(rnd() * COLS.length)];
      g.fillRect(x, y + ih - 2.5 - bh, bw, bh);
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x + 0.6, y + ih - 2.5 - bh + 1.5, 0.8, bh - 3);
      x += bw + 0.6;
    }
    rr(g, 3.5, y + ih - 2.5, W - 7, 2.8, 1); fillStroke(g, WOOD.hi, WOOD.line, 0.8); // 선반
  }
  g.fillStyle = "rgba(255,255,255,.3)"; rr(g, 5, 3, W - 10, 1.4, 1); g.fill();
}

// ---- 나무 조리대(v3): 나무 몸통 + 돌 화덕 + 냄비 ----
function stove(g, W, H) {
  shadow(g, W / 2, H - 3, W / 2 - 3, 3);
  rr(g, 2, 4, W - 4, H - 8, 4); fillStroke(g, woodGrad(g, 0, 4, 0, H - 4, WOOD.mid, WOOD.lo));
  rr(g, 1, 3, W - 2, 7, 3); fillStroke(g, woodGrad(g, 0, 3, 0, 10));                         // 위판
  const big = W >= H, cx = big ? W * 0.32 : W / 2, cy = big ? H * 0.58 : H * 0.32;
  rr(g, cx - 9, cy - 7, 18, 14, 3); fillStroke(g, "#9a9da3", "#5f6268");                       // 화덕
  g.fillStyle = "#3b3a3a"; g.beginPath(); g.ellipse(cx, cy, 6, 4, 0, 0, 7); g.fill();
  g.fillStyle = "#f7941d"; g.beginPath(); g.ellipse(cx, cy + 1, 3, 1.6, 0, 0, 7); g.fill();
  const px2 = big ? W * 0.7 : W / 2, py2 = big ? H * 0.5 : H * 0.7;                          // 냄비
  rr(g, px2 - 7, py2 - 5, 14, 9, 3); fillStroke(g, "#d9534f", "#7a2b28");
  g.fillStyle = "#f4f1ea"; rr(g, px2 - 6, py2 - 6.5, 12, 2.5, 1); g.fill();
  g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 0.9;
  for (const dx of [-3, 1]) { g.beginPath(); g.moveTo(px2 + dx, py2 - 8); g.quadraticCurveTo(px2 + dx + 2, py2 - 11, px2 + dx, py2 - 14); g.stroke(); }
  g.fillStyle = "rgba(255,255,255,.3)"; rr(g, 4, 4, W - 8, 1.4, 1); g.fill();
}

// ---- 나무 옷장(v3): 문 두 짝 + 손잡이 + 위 장식, 세로로 돌리면 문 한 짝씩 위아래 ----
function wardrobe(g, W, H) {
  shadow(g, W / 2, H - 2.5, W / 2 - 2, 2.5);
  rr(g, 2, 1, W - 4, H - 4, 3); fillStroke(g, woodGrad(g, 0, 0, 0, H, WOOD.mid, WOOD.lo));
  rr(g, 1, 0.5, W - 2, 4, 2); fillStroke(g, woodGrad(g, 0, 0, 0, 4));                       // 위 장식판
  const wide = W >= H, n = 2;
  for (let i = 0; i < n; i++) {
    const x = wide ? 4 + i * (W - 8) / n : 4, y = wide ? 6 : 6 + i * (H - 11) / n;
    const w = wide ? (W - 8) / n - 1.5 : W - 8, h = wide ? H - 11 : (H - 11) / n - 1.5;
    rr(g, x, y, w, h, 2); fillStroke(g, woodGrad(g, x, 0, x + w, 0, WOOD.hi, WOOD.mid), WOOD.line, 0.9);
    g.strokeStyle = "rgba(110,67,37,.35)"; g.lineWidth = 0.7; rr(g, x + 2.5, y + 2.5, w - 5, h - 5, 1.5); g.stroke();
    g.fillStyle = "#f2cf5b";                                                                    // 손잡이(가운데 쪽)
    const hx = wide ? (i === 0 ? x + w - 3 : x + 3) : x + w / 2, hy = wide ? y + h / 2 : (i === 0 ? y + h - 3 : y + 3);
    g.beginPath(); g.arc(hx, hy, 1.4, 0, 7); g.fill();
  }
  g.fillStyle = "rgba(255,255,255,.3)"; rr(g, 4, 1.5, W - 8, 1.2, 1); g.fill();
}

// ---- v4 가구 ----
// 등받이(벽 쪽)가 위인 그림을 rot만큼 시계 방향으로 돌려 담는다: 0 위 / 1 오른쪽 / 2 아래 / 3 왼쪽 벽
// W,H는 돌린 뒤 칸 크기 — 홀수 rot이면 원래 그림은 H×W로 그린다
function turn(g, W, H, rot, fn) {
  const r = rot & 3;
  if (r === 0) return fn(g, W, H);
  g.save();
  if (r === 1) { g.translate(W, 0); g.rotate(Math.PI / 2); fn(g, H, W); }
  else if (r === 2) { g.translate(W, H); g.rotate(Math.PI); fn(g, W, H); }
  else { g.translate(0, H); g.rotate(-Math.PI / 2); fn(g, H, W); }
  g.restore();
}

// 소파: 등받이 + 팔걸이 + 방석 두 개 + 쿠션
function sofa(g, W, H) {
  shadow(g, W / 2, H - 3, W / 2 - 3, 3);
  const C = { hi: "#8fc1e3", mid: "#5d9cc9", lo: "#3f7aa5", line: "#2b5577" };
  rr(g, 3, 3, W - 6, 13, [6, 6, 2, 2]); fillStroke(g, woodGrad(g, 0, 3, 0, 16, C.hi, C.mid), C.line);       // 등받이
  for (const x of [2, W - 10]) { rr(g, x, 9, 8, H - 13, 4); fillStroke(g, woodGrad(g, x, 0, x + 8, 0, C.mid, C.lo), C.line); } // 팔걸이
  const sw = (W - 20) / 2;
  for (let i = 0; i < 2; i++) { rr(g, 10 + i * sw, 13, sw - 1, H - 19, 3); fillStroke(g, woodGrad(g, 0, 13, 0, H - 6, C.hi, C.mid), C.line, 1); } // 방석
  g.fillStyle = WOOD.dk; for (const x of [6, W - 9]) { rr(g, x, H - 7, 3, 4, 1); g.fill(); }
  g.save(); g.translate(17, 12); g.rotate(-0.25); rr(g, -5, -5, 10, 10, 3); fillStroke(g, "#ffd35c", "#c99a2a", 0.9); g.restore(); // 쿠션
  g.save(); g.translate(W - 17, 12); g.rotate(0.25); rr(g, -5, -5, 10, 10, 3); fillStroke(g, "#ff9fb1", "#c9687c", 0.9); g.restore();
  g.fillStyle = "rgba(255,255,255,.35)"; rr(g, 8, 4.5, W - 16, 1.6, 1); g.fill();
}

// 식탁: 긴 위판 + 접시 둘 + 가운데 과일 바구니
function diningTable(g, W, H) {
  table.call(null, g, W, H);
  const cy = H / 2 - 3;
  for (const cx of [W * 0.2, W * 0.8]) {
    g.fillStyle = "#fffaf2"; g.beginPath(); g.ellipse(cx, cy, 5.5, 4, 0, 0, 7); g.fill(); g.strokeStyle = "#cdbfa6"; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = "#e9e1d2"; g.beginPath(); g.ellipse(cx, cy, 3, 2, 0, 0, 7); g.fill();
  }
}

// 벽난로: 돌 몸통 + 아치 + 불 + 위 선반
function fireplace(g, W, H) {
  shadow(g, W / 2, H - 2.5, W / 2 - 2, 2.5);
  rr(g, 2, 3, W - 4, H - 6, 3); fillStroke(g, "#b9b4ab", "#6d6862");
  g.strokeStyle = "rgba(90,85,80,.45)"; g.lineWidth = 0.8;                                   // 돌 줄눈
  for (let y = 9; y < H - 4; y += 6) for (let x = 4 + ((y / 6) % 2) * 5; x < W - 6; x += 10) { rr(g, x, y, 9, 5, 1.5); g.stroke(); }
  rr(g, 0.5, 2, W - 1, 5, 2); fillStroke(g, woodGrad(g, 0, 2, 0, 7), WOOD.line);           // 선반
  const ax = W / 2, aw = Math.min(22, W * 0.4);
  g.beginPath(); g.moveTo(ax - aw / 2, H - 4); g.lineTo(ax - aw / 2, 15); g.arc(ax, 15, aw / 2, Math.PI, 0); g.lineTo(ax + aw / 2, H - 4); g.closePath();
  fillStroke(g, "#2f2622", "#4a3d36");
  const fire = g.createRadialGradient(ax, H - 8, 1, ax, H - 9, 9); fire.addColorStop(0, "#fff3b0"); fire.addColorStop(0.5, "#ffb52e"); fire.addColorStop(1, "rgba(240,90,30,0)");
  g.fillStyle = fire; g.beginPath(); g.ellipse(ax, H - 10, 7, 8, 0, 0, 7); g.fill();
  g.fillStyle = WOOD.lo; rr(g, ax - 7, H - 6, 14, 2.5, 1); g.fill();
  g.fillStyle = "#7fb7d8"; rr(g, W * 0.18, -1, 4, 4, 1); g.fill(); g.fillStyle = "#ffd35c"; g.beginPath(); g.arc(W * 0.8, 1, 2, 0, 7); g.fill(); // 선반 위 장식
}

// 낮은 수납장: 서랍 셋 + 손잡이 + 위 화분
function cabinet(g, W, H) {
  shadow(g, W / 2, H - 2.5, W / 2 - 2, 2.5);
  rr(g, 2, 6, W - 4, H - 10, 3); fillStroke(g, woodGrad(g, 0, 6, 0, H - 4, WOOD.mid, WOOD.lo));
  rr(g, 1, 4, W - 2, 5, 2); fillStroke(g, woodGrad(g, 0, 4, 0, 9));
  const n = 3, dw = (W - 10) / n;
  for (let i = 0; i < n; i++) {
    const x = 5 + i * dw; rr(g, x, 11, dw - 2, H - 18, 2); fillStroke(g, woodGrad(g, x, 0, x + dw, 0, WOOD.hi, WOOD.mid), WOOD.line, 0.8);
    g.fillStyle = "#f2cf5b"; g.beginPath(); g.arc(x + dw / 2 - 1, 11 + (H - 18) / 2, 1.5, 0, 7); g.fill();
  }
  g.fillStyle = "#5fb35a"; g.beginPath(); g.arc(W - 9, 1, 3.5, 0, 7); g.fill(); g.fillStyle = "#d9774a"; rr(g, W - 12, 1, 6, 4, 1); g.fill();
}

// 흔들의자: 곡선 다리 + 등받이 + 방석 — rot 0 등받이 위 / 1 오른쪽 / 2 아래 / 3 왼쪽(옆모습은 의자와 같은 방식)
function rocking(g, rot) {
  shadow(g, 16, 29, 11, 2.5);
  const back = (x, y, w, h) => {
    rr(g, x, y, w, h, [6, 6, 2, 2]); fillStroke(g, woodGrad(g, 0, y, 0, y + h, WOOD.mid, WOOD.lo));
    g.fillStyle = "rgba(60,35,18,.4)"; for (const k of [0.25, 0.5, 0.75]) { rr(g, x + w * k - 0.8, y + 3, 1.6, h - 5, 1); g.fill(); }
  };
  const seat = (x, y, w, h) => { rr(g, x, y, w, h, 3); fillStroke(g, woodGrad(g, 0, y, 0, y + h)); g.fillStyle = "#b48ad6"; rr(g, x + 3, y + 1, w - 6, h - 3, 2.5); g.fill(); };
  if (rot === 0 || rot === 2) {
    g.strokeStyle = WOOD.dk; g.lineWidth = 2.4; g.beginPath(); g.moveTo(3, 25); g.quadraticCurveTo(16, 31, 29, 25); g.stroke();
    g.fillStyle = WOOD.dk; for (const x of [8, 22]) { rr(g, x, 19, 2.5, 8, 1); g.fill(); }
    if (rot === 0) { back(6, 2, 20, 15); seat(5, 14, 22, 8); }
    else { seat(5, 8, 22, 9); back(6, 14, 20, 12); }
    return;
  }
  g.save(); if (rot === 3) { g.translate(32, 0); g.scale(-1, 1); }
  // 옆모습: 바닥의 흔들 곡선 + 다리 + 방석 + 오른쪽에 높은 등받이(살짝 뒤로 기움)
  g.strokeStyle = WOOD.dk; g.lineWidth = 2.4; g.beginPath(); g.moveTo(2, 24); g.quadraticCurveTo(14, 31, 28, 26); g.stroke();
  g.fillStyle = WOOD.dk; for (const x of [7, 19]) { rr(g, x, 18, 2.5, 8, 1); g.fill(); }
  seat(4, 13, 19, 7);
  g.save(); g.translate(24, 2); g.rotate(0.12);
  rr(g, -3, 0, 6, 20, 2.5); fillStroke(g, woodGrad(g, -3, 0, 3, 0, WOOD.mid, WOOD.lo));
  g.fillStyle = "rgba(255,255,255,.3)"; rr(g, -1.8, 2, 1.4, 15, 1); g.fill();
  g.restore();
  g.fillStyle = WOOD.mid; rr(g, 3, 10, 2.5, 6, 1); g.fill();   // 팔걸이 앞 기둥
  g.restore();
}

// 어항: 받침 + 둥근 유리 + 물 + 물고기 둘 + 물풀
function fishTank(g) {
  shadow(g, 16, 29, 9, 2.5);
  rr(g, 8, 24, 16, 5, 2); fillStroke(g, woodGrad(g, 0, 24, 0, 29));
  g.beginPath(); g.ellipse(16, 15, 11, 10, 0, 0, 7); fillStroke(g, "rgba(200,235,255,.55)", "#7fb7d8", 1.2);
  g.save(); g.beginPath(); g.ellipse(16, 15, 10, 9, 0, 0, 7); g.clip();
  g.fillStyle = "rgba(90,170,220,.75)"; g.fillRect(4, 10, 24, 16);
  g.fillStyle = "#e9d8a6"; g.fillRect(4, 21, 24, 4);
  g.strokeStyle = "#3f8a3a"; g.lineWidth = 1.3; for (const x of [10, 22]) { g.beginPath(); g.moveTo(x, 22); g.quadraticCurveTo(x - 2, 17, x + 1, 13); g.stroke(); }
  const fish = (x, y, c, f) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 3, 2, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 3 * f, y); g.lineTo(x - 5.5 * f, y - 2); g.lineTo(x - 5.5 * f, y + 2); g.fill(); };
  fish(14, 15, "#f7941d", 1); fish(19, 19, "#ff7d95", -1);
  g.restore();
  g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(11, 9, 3, 1.4, -0.5, 0, 7); g.fill();
}

// 큰 화분 나무: 둥근 잎 덩어리 + 줄기 + 큰 화분
function treePot(g) {
  shadow(g, 16, 29, 9, 2.5);
  g.fillStyle = "#7a4a28"; rr(g, 14.5, 12, 3, 10, 1); g.fill();
  for (const [x, y, r, c] of [[16, 9, 8, "#4f9d4a"], [10, 12, 5.5, "#5fb35a"], [22, 12, 5.5, "#5fb35a"], [16, 5, 5, "#6fc46a"]]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(13, 6, 2.5, 0, 7); g.fill();
  g.beginPath(); g.moveTo(9, 20); g.lineTo(23, 20); g.lineTo(21, 29); g.lineTo(11, 29); g.closePath(); fillStroke(g, woodGrad(g, 9, 0, 23, 0, "#f2f0ea", "#c9c4b8"), "#8a857a");
  g.strokeStyle = "#7fb7d8"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10, 23.5); g.lineTo(22, 23.5); g.stroke();
}

// 피아노: 검은 몸통 + 건반 + 악보대
function piano(g, W, H) {
  shadow(g, W / 2, H - 2.5, W / 2 - 2, 2.5);
  rr(g, 2, 2, W - 4, H - 6, 3); fillStroke(g, woodGrad(g, 0, 2, 0, H - 4, "#4a3b45", "#241c22"), "#120d10");
  g.fillStyle = "rgba(255,255,255,.25)"; rr(g, 5, 3.5, W - 10, 1.4, 1); g.fill();
  rr(g, W / 2 - 7, 5, 14, 7, 1); fillStroke(g, "#fffaf2", "#bfb3a0", 0.7);                    // 악보
  g.strokeStyle = "#555"; g.lineWidth = 0.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(W / 2 - 5, 7 + i * 2); g.lineTo(W / 2 + 5, 7 + i * 2); g.stroke(); }
  const ky = H - 15, kh = 8, n = Math.floor((W - 8) / 4);
  g.fillStyle = "#fffdf8"; g.fillRect(4, ky, n * 4, kh);
  g.strokeStyle = "#9a9088"; g.lineWidth = 0.5; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(4 + i * 4, ky); g.lineTo(4 + i * 4, ky + kh); g.stroke(); }
  g.fillStyle = "#1b1418"; for (let i = 0; i < n; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) g.fillRect(4 + i * 4 + 2.6, ky, 2.4, kh * 0.6);
}

const DRAW = {
  sofa_wood: (g, W, H, rot) => turn(g, W, H, rot, sofa),
  dining_table: (g, W, H) => diningTable(g, W, H),
  fireplace_stone: (g, W, H, rot) => turn(g, W, H, rot, fireplace),
  cabinet_low: (g, W, H, rot) => turn(g, W, H, rot, cabinet),
  rocking_chair: (g, W, H, rot) => rocking(g, rot),
  fish_tank: g => fishTank(g),
  tree_pot: g => treePot(g),
  piano_wood: (g, W, H, rot) => turn(g, W, H, rot, piano),
  wardrobe_wood: (g, W, H, rot) => turn(g, W, H, rot, wardrobe),
  stove_wood: (g, W, H, rot) => turn(g, W, H, rot, stove),
  table_wood: (g, W, H) => table(g, W, H),
  chair_wood: (g, W, H, rot) => chair(g, rot),
  pot_flower: g => pot(g),
  lamp_shell: g => lamp(g),
  bed_log: (g, W, H, rot) => { bed.rot = rot; bed(g, Math.min(W, H)); },
  bookshelf_wood: (g, W, H, rot) => turn(g, W, H, rot, shelf),
};

// w,h = 돌린 뒤 칸 수
export function furnArt(type, w, h, rot = 0) {
  const key = type + "|" + w + "|" + h + "|" + rot;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = w * U * K; c.height = h * U * K;
  const g = c.getContext("2d"); g.scale(K, K); g.lineJoin = "round"; g.lineCap = "round";
  const fn = DRAW[type];
  if (fn) fn(g, w * U, h * U, rot % 4);
  else { rr(g, 3, 3, w * U - 6, h * U - 6, 4); fillStroke(g, "#c9b79c"); }
  cache.set(key, c);
  return c;
}
