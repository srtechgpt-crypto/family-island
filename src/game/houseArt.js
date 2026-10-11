// 집 겉모습 그림(v3): 지붕·벽·문·창문·우편함·울타리·문패. 시제품 v3시제품.html과 같은 그림
// 캔버스는 집(6×5칸) 둘레로 여유를 둔다: 왼쪽·오른쪽 0.5칸, 위 1칸, 아래 0.8칸
export const HOUSE_PAD = { l: 0.5, t: 1, r: 0.5, b: 0.8 };
const S = 40;   // 캔버스 1칸 = 40px
const cache = new Map();

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255];
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}

// (ox,oy) = 집 본체 왼쪽 위, s = 1칸 크기
export function drawHouse(g, ext, def, name, ox, oy, s) {
  const W = 6 * s, wallTop = oy + s * 2.3, base = oy + 5 * s;
  const rc = def.roofColors[ext.roofColor] || def.roofColors[0];
  const wc = def.wallColors[ext.wallColor] || def.wallColors[0];
  const dc = def.doorColors[ext.doorColor] || def.doorColors[0];
  g.fillStyle = "rgba(30,50,20,.22)"; g.beginPath(); g.ellipse(ox + W / 2, base, W * 0.55, s * 0.45, 0, 0, 7); g.fill();
  // 벽
  rr(g, ox + s * 0.45, wallTop, W - s * 0.9, base - wallTop, s * 0.15); g.fillStyle = wc; g.fill();
  g.strokeStyle = shade(wc, -0.35); g.lineWidth = s * 0.06; g.stroke();
  g.fillStyle = shade(wc, -0.12); g.fillRect(ox + s * 0.45, base - s * 0.35, W - s * 0.9, s * 0.35);
  g.strokeStyle = shade(wc, -0.07); g.lineWidth = s * 0.03;
  for (let i = 1; i < 4; i++) { const y = wallTop + i * (base - wallTop) / 4; g.beginPath(); g.moveTo(ox + s * 0.5, y); g.lineTo(ox + W - s * 0.5, y); g.stroke(); }
  // 지붕
  const eave = wallTop + s * 0.35;
  g.beginPath();
  if (ext.roofShape === "hip") { g.moveTo(ox, eave); g.lineTo(ox + s * 1.3, oy + s * 0.3); g.lineTo(ox + W - s * 1.3, oy + s * 0.3); g.lineTo(ox + W, eave); }
  else if (ext.roofShape === "round") { g.moveTo(ox, eave); g.bezierCurveTo(ox + s * 0.2, oy - s * 0.4, ox + W - s * 0.2, oy - s * 0.4, ox + W, eave); }
  else { g.moveTo(ox, eave); g.lineTo(ox + W / 2, oy - s * 0.1); g.lineTo(ox + W, eave); }
  g.closePath();
  const rg = g.createLinearGradient(0, oy, 0, eave); rg.addColorStop(0, shade(rc, 0.18)); rg.addColorStop(1, shade(rc, -0.12));
  g.fillStyle = rg; g.fill(); g.strokeStyle = shade(rc, -0.45); g.lineWidth = s * 0.07; g.stroke();
  g.save(); g.clip(); g.strokeStyle = shade(rc, -0.22); g.lineWidth = s * 0.05;
  for (let y = eave - s * 0.35; y > oy - s; y -= s * 0.38) { g.beginPath(); for (let x = ox; x <= ox + W; x += s * 0.4) g.arc(x, y, s * 0.2, 0, Math.PI); g.stroke(); }
  g.restore();
  g.fillStyle = shade(rc, -0.3); rr(g, ox - s * 0.05, eave - s * 0.08, W + s * 0.1, s * 0.22, s * 0.1); g.fill();
  if (ext.roofShape !== "round") { g.fillStyle = shade(rc, -0.25); rr(g, ox + W * 0.72, oy + s * 0.25, s * 0.5, s * 0.9, s * 0.06); g.fill(); g.fillStyle = shade(rc, -0.45); g.fillRect(ox + W * 0.72 - s * 0.05, oy + s * 0.2, s * 0.6, s * 0.15); }
  // 창문 2개
  for (const wx of [ox + s * 1.0, ox + W - s * 2.0]) {
    const wy = wallTop + s * 0.75, ws = s;
    g.fillStyle = "#fff"; g.strokeStyle = shade(dc, -0.2); g.lineWidth = s * 0.1;
    if (ext.windowShape === "round") { g.beginPath(); g.arc(wx + ws / 2, wy + ws / 2, ws / 2, 0, 7); g.fill(); g.stroke(); g.fillStyle = "#bfe3ef"; g.beginPath(); g.arc(wx + ws / 2, wy + ws / 2, ws / 2 - s * 0.1, 0, 7); g.fill(); }
    else { rr(g, wx, wy, ws, ws, s * 0.08); g.fill(); g.stroke(); g.fillStyle = "#bfe3ef"; g.fillRect(wx + s * 0.1, wy + s * 0.1, ws - s * 0.2, ws - s * 0.2); }
    g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.moveTo(wx + s * 0.2, wy + s * 0.55); g.lineTo(wx + s * 0.55, wy + s * 0.2); g.lineTo(wx + s * 0.65, wy + s * 0.2); g.lineTo(wx + s * 0.2, wy + s * 0.65); g.fill();
    if (ext.windowShape === "cross") { g.fillStyle = shade(dc, -0.2); g.fillRect(wx + ws / 2 - s * 0.04, wy, s * 0.08, ws); g.fillRect(wx, wy + ws / 2 - s * 0.04, ws, s * 0.08); }
    g.fillStyle = "#ff8fa3"; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(wx + s * 0.15 + i * s * 0.24, wy + ws + s * 0.12, s * 0.11, 0, 7); g.fill(); }
    g.fillStyle = shade(wc, -0.3); g.fillRect(wx - s * 0.05, wy + ws + s * 0.18, ws + s * 0.1, s * 0.1);
  }
  // 문(본체 x+2 칸 가운데, 아래쪽)
  const dx = ox + s * 2.5, dw = s, dh = s * 1.55, dy = base - dh;
  g.fillStyle = dc; g.strokeStyle = shade(dc, -0.45); g.lineWidth = s * 0.07;
  if (ext.doorShape === "arch") { g.beginPath(); g.moveTo(dx, base); g.lineTo(dx, dy + dw / 2); g.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw, base); g.closePath(); }
  else rr(g, dx, dy, dw, dh, s * 0.08);
  g.fill(); g.stroke();
  g.strokeStyle = shade(dc, -0.25); g.lineWidth = s * 0.04;
  rr(g, dx + s * 0.15, dy + s * (ext.doorShape === "arch" ? 0.55 : 0.18), dw - s * 0.3, s * 0.5, s * 0.05); g.stroke();
  rr(g, dx + s * 0.15, dy + s * 0.85, dw - s * 0.3, s * 0.5, s * 0.05); g.stroke();
  g.fillStyle = "#f2cf5b"; g.beginPath(); g.arc(dx + dw - s * 0.2, dy + dh * 0.58, s * 0.08, 0, 7); g.fill();
  g.fillStyle = "#c9b28c"; rr(g, dx - s * 0.15, base - s * 0.08, dw + s * 0.3, s * 0.2, s * 0.06); g.fill();
  // 문패
  const nw = s * 1.7; g.fillStyle = "#c58b55"; rr(g, ox + W / 2 - nw / 2, wallTop + s * 0.08, nw, s * 0.5, s * 0.12); g.fill();
  g.strokeStyle = "#6e4325"; g.lineWidth = s * 0.05; g.stroke();
  g.fillStyle = "#fff8e8"; g.font = `${Math.round(s * 0.36)}px Jua, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(name || "", ox + W / 2, wallTop + s * 0.34, nw - s * 0.2); g.textBaseline = "alphabetic";
  // 우편함(문 오른쪽, 문 앞 칸은 비움)
  const mx = ox + s * 4.3, my = base + s * 0.1;
  if (ext.mailbox === "wall") { g.fillStyle = "#e05a4f"; rr(g, ox + s * 3.75, base - s * 1.25, s * 0.55, s * 0.45, s * 0.08); g.fill(); g.fillStyle = "#fff"; g.fillRect(ox + s * 3.85, base - s * 1.1, s * 0.35, s * 0.05); }
  else {
    g.fillStyle = "#7a5233"; g.fillRect(mx + s * 0.22, my - s * 0.55, s * 0.12, s * 0.75);
    if (ext.mailbox === "round") { g.fillStyle = "#f2a4b8"; g.beginPath(); g.moveTo(mx, my - s * 0.5); g.lineTo(mx, my - s * 0.8); g.arc(mx + s * 0.3, my - s * 0.8, s * 0.3, Math.PI, 0); g.lineTo(mx + s * 0.6, my - s * 0.5); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(mx + s * 0.3, my - s * 0.78, s * 0.08, 0, 7); g.fill(); }
    else { g.fillStyle = "#4f8fc9"; rr(g, mx, my - s * 0.95, s * 0.6, s * 0.45, s * 0.08); g.fill(); g.fillStyle = "#e05a4f"; g.fillRect(mx + s * 0.5, my - s * 1.05, s * 0.06, s * 0.3); }
  }
  // 울타리(앞쪽, 문 앞은 비움) — 장식이라 길을 막지 않음
  if (ext.fence === "wood" || ext.fence === "stone") {
    const fy = base + s * 0.55;
    for (const [a, b] of [[ox - s * 0.3, ox + s * 2.2], [ox + s * 3.8, ox + W + s * 0.3]]) {
      if (ext.fence === "wood") {
        g.fillStyle = "#c58b55"; g.fillRect(a, fy - s * 0.35, b - a, s * 0.1); g.fillRect(a, fy - s * 0.15, b - a, s * 0.1);
        for (let x = a; x <= b - s * 0.15; x += s * 0.42) { g.fillStyle = "#e0ad74"; g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy - s * 0.5); g.lineTo(x + s * 0.09, fy - s * 0.62); g.lineTo(x + s * 0.18, fy - s * 0.5); g.lineTo(x + s * 0.18, fy); g.fill(); g.strokeStyle = "#8a5a3a"; g.lineWidth = s * 0.03; g.stroke(); }
      } else {
        for (let x = a, i = 0; x < b - s * 0.1; x += s * 0.36, i++) { g.fillStyle = i % 2 ? "#a7a9ae" : "#bfc1c6"; rr(g, x, fy - s * (i % 2 ? 0.42 : 0.36), s * 0.34, s * 0.4, s * 0.12); g.fill(); g.strokeStyle = "#7d8086"; g.lineWidth = s * 0.03; g.stroke(); }
      }
    }
  }
}

// 게임용: 겉모습+이름이 같으면 같은 캔버스 재사용
export function houseCanvas(ext, def, name) {
  const key = JSON.stringify(ext) + "|" + name;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = (6 + HOUSE_PAD.l + HOUSE_PAD.r) * S; c.height = (5 + HOUSE_PAD.t + HOUSE_PAD.b) * S;
  const g = c.getContext("2d"); g.lineJoin = "round";
  drawHouse(g, ext, def, name, HOUSE_PAD.l * S, HOUSE_PAD.t * S, S);
  if (cache.size > 60) cache.clear();
  cache.set(key, c);
  return c;
}
// 글꼴(Jua)이 늦게 들어오면 문패를 다시 그리도록
try { document.fonts.addEventListener("loadingdone", () => cache.clear()); } catch { /* 무시 */ }
