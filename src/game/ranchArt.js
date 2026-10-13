// 버전 7 목장 그림(코드로 그림): 닭장·닭·둥지·모이통·씨앗 상자·동물 친구 집·텃밭 작물·애완동물
// 좌표는 화면 픽셀, s = 한 칸 크기(TS)

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const fs = (g, fill, stroke, lw = 1.5) => { g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } };
const shadow = (g, cx, cy, rx, ry) => { g.fillStyle = "rgba(40,25,10,.22)"; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };
// PixelLab 동물 그림(art/animal): 오른쪽을 보는 옆모습, 여백 없이 잘림. 못 불러오면 아래 코드 그림
const ANI = {};
export async function loadAnimalArt() {
  const names = ["hen", "sheep", "sheep_sheared", "dog", "cat", "rabbit"];
  try {
    const imgs = await Promise.all(names.map(n => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "art/animal/" + n + ".png"; })));
    names.forEach((n, i) => { ANI[n] = imgs[i]; });
  } catch (e) { for (const k of Object.keys(ANI)) delete ANI[k]; }
}
// 발밑(cx,cy)에 키 h로 그림. flip = 왼쪽 보기, rot = 앞으로 숙이기(라디안), sq = 납작해지기
function drawAni(g, img, cx, cy, h, flip, rot = 0, sq = 0) {
  const w = h * img.width / img.height, sm = g.imageSmoothingEnabled;
  g.save(); g.translate(cx, cy); if (flip) g.scale(-1, 1); g.rotate(rot); g.scale(1 + sq, 1 - sq);
  g.imageSmoothingEnabled = false; g.drawImage(img, -w / 2, -h, w, h); g.imageSmoothingEnabled = sm;
  g.restore();
}

// ---- 닭장: x,y,w,h = 칸 단위를 화면 픽셀로 바꾼 사각형 ----
export function drawCoop(g, x, y, w, h, s) {
  shadow(g, x + w / 2, y + h - s * 0.05, w * 0.48, s * 0.18);
  const top = y + h * 0.32;
  rr(g, x + s * 0.15, top, w - s * 0.3, h - (top - y) - s * 0.1, s * 0.12); fs(g, "#d9a46b", "#7a4f2b", 2);   // 나무 벽
  g.strokeStyle = "rgba(122,79,43,.35)"; g.lineWidth = 1;
  for (let yy = top + s * 0.3; yy < y + h - s * 0.2; yy += s * 0.3) { g.beginPath(); g.moveTo(x + s * 0.2, yy); g.lineTo(x + w - s * 0.2, yy); g.stroke(); }
  g.beginPath(); g.moveTo(x - s * 0.1, top + s * 0.1); g.lineTo(x + w / 2, y - s * 0.15); g.lineTo(x + w + s * 0.1, top + s * 0.1); g.closePath(); fs(g, "#d9534f", "#7a2b28", 2);   // 빨간 지붕
  g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.moveTo(x + w * 0.2, top - s * 0.05); g.lineTo(x + w / 2, y + s * 0.05); g.lineTo(x + w * 0.5, y + s * 0.2); g.closePath(); g.fill();
  const dx = x + w / 2 - s * 0.35, dy = y + h - s * 0.95;                     // 둥근 문
  g.beginPath(); g.moveTo(dx, y + h - s * 0.12); g.lineTo(dx, dy + s * 0.35); g.arc(dx + s * 0.35, dy + s * 0.35, s * 0.35, Math.PI, 0); g.lineTo(dx + s * 0.7, y + h - s * 0.12); g.closePath(); fs(g, "#5a3620", "#3b2414", 1.5);
  g.strokeStyle = "#c58b55"; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(dx + s * 0.1, y + h - s * 0.1); g.lineTo(dx + s * 0.6, y + h + s * 0.25); g.stroke();   // 경사판
  rr(g, x + s * 0.4, top + s * 0.3, s * 0.55, s * 0.45, s * 0.08); fs(g, "#bfe3ef", "#7a4f2b", 1.5);   // 창
  g.font = `${Math.round(s * 0.42)}px Jua, sans-serif`; g.textAlign = "center"; g.fillStyle = "#fffdf6"; g.fillText("🐔", x + w - s * 0.7, top + s * 0.62);
}

// ---- 닭 ----
export function drawHen(g, cx, cy, s, flip, t, peck) {
  if (ANI.hen) { shadow(g, cx, cy + s * 0.02, s * 0.28, s * 0.08); drawAni(g, ANI.hen, cx, cy, s * 0.9, flip, peck ? Math.max(0, Math.sin(t * 9)) * 0.35 : 0, Math.sin(t * 3) * 0.02); return; }
  g.save(); g.translate(cx, cy); if (flip) g.scale(-1, 1);
  shadow(g, 0, s * 0.02, s * 0.28, s * 0.08);
  const bob = peck ? Math.max(0, Math.sin(t * 9)) * s * 0.12 : Math.sin(t * 3) * s * 0.015;
  g.fillStyle = "#e9a43c"; for (const lx of [-0.06, 0.06]) g.fillRect(lx * s, -s * 0.12, s * 0.035, s * 0.12);   // 다리
  g.beginPath(); g.ellipse(0, -s * 0.24, s * 0.27, s * 0.2, 0, 0, 7); fs(g, "#fffaf2", "#bfb3a0", 1.2);       // 몸
  g.beginPath(); g.ellipse(-s * 0.08, -s * 0.24, s * 0.14, s * 0.09, -0.3, 0, 7); fs(g, "#f1e8d8");            // 날개
  g.beginPath(); g.moveTo(-s * 0.25, -s * 0.3); g.lineTo(-s * 0.38, -s * 0.42); g.lineTo(-s * 0.3, -s * 0.24); g.closePath(); fs(g, "#fffaf2", "#bfb3a0", 1);   // 꼬리
  const hx = s * 0.2, hy = -s * 0.42 + bob;
  g.beginPath(); g.arc(hx, hy, s * 0.13, 0, 7); fs(g, "#fffaf2", "#bfb3a0", 1.2);                              // 머리
  g.fillStyle = "#e3463b"; g.beginPath(); g.arc(hx - s * 0.03, hy - s * 0.13, s * 0.05, 0, 7); g.arc(hx + s * 0.04, hy - s * 0.12, s * 0.045, 0, 7); g.fill();   // 볏
  g.beginPath(); g.ellipse(hx + s * 0.05, hy + s * 0.1, s * 0.03, s * 0.05, 0, 0, 7); g.fill();               // 턱
  g.fillStyle = "#f2b33c"; g.beginPath(); g.moveTo(hx + s * 0.12, hy - s * 0.02); g.lineTo(hx + s * 0.21, hy + s * 0.01); g.lineTo(hx + s * 0.12, hy + s * 0.04); g.closePath(); g.fill();   // 부리
  g.fillStyle = "#24352a"; g.beginPath(); g.arc(hx + s * 0.05, hy - s * 0.02, s * 0.022, 0, 7); g.fill();
  g.restore();
}

export function drawNest(g, cx, cy, s) {
  g.beginPath(); g.ellipse(cx, cy, s * 0.36, s * 0.17, 0, 0, 7); fs(g, "#d6b46a", "#a07d3a", 1.2);
  g.strokeStyle = "rgba(160,125,58,.8)"; g.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * s * 0.09, cy - s * 0.12); g.lineTo(cx + i * s * 0.07 + s * 0.05, cy + s * 0.12); g.stroke(); }
  g.beginPath(); g.ellipse(cx, cy - s * 0.03, s * 0.22, s * 0.08, 0, 0, 7); fs(g, "#b48f4a");
}
export function drawEgg(g, cx, cy, s) {
  g.beginPath(); g.ellipse(cx, cy - s * 0.12, s * 0.12, s * 0.15, 0, 0, 7); fs(g, "#fff8ec", "#cdbfa6", 1.2);
  g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(cx - s * 0.04, cy - s * 0.18, s * 0.03, s * 0.05, -0.4, 0, 7); g.fill();
}

export function drawTrough(g, x, y, s, fed) {
  shadow(g, x + s / 2, y + s * 0.85, s * 0.48, s * 0.12);
  rr(g, x + s * 0.02, y + s * 0.38, s * 0.96, s * 0.42, s * 0.1); fs(g, "#b07a46", "#6e4325", 1.5);
  rr(g, x + s * 0.1, y + s * 0.42, s * 0.8, s * 0.16, s * 0.06); fs(g, fed ? "#e6c45a" : "#6e4325");
  if (fed) { g.fillStyle = "#c99a2a"; for (let i = 0; i < 9; i++) g.fillRect(x + s * (0.15 + i * 0.08), y + s * (0.44 + (i % 3) * 0.03), s * 0.03, s * 0.03); }
  g.fillStyle = "#6e4325"; g.fillRect(x + s * 0.1, y + s * 0.78, s * 0.08, s * 0.15); g.fillRect(x + s * 0.82, y + s * 0.78, s * 0.08, s * 0.15);
}

export function drawSeedbox(g, x, y, s, ready) {
  shadow(g, x + s / 2, y + s * 0.9, s * 0.45, s * 0.12);
  rr(g, x + s * 0.06, y + s * 0.3, s * 0.88, s * 0.6, s * 0.08); fs(g, "#c58b55", "#6e4325", 1.5);
  g.strokeStyle = "#8a5a3a"; g.lineWidth = 1.2; for (const k of [0.5, 0.7]) { g.beginPath(); g.moveTo(x + s * 0.08, y + s * k); g.lineTo(x + s * 0.92, y + s * k); g.stroke(); }
  for (const [dx, c] of [[0.3, "#6fbf73"], [0.5, "#5fb35a"], [0.7, "#7fd07a"]]) {               // 새싹 그림
    g.strokeStyle = "#3f8a3a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + s * dx, y + s * 0.32); g.lineTo(x + s * dx, y + s * 0.14); g.stroke();
    g.fillStyle = c; g.beginPath(); g.ellipse(x + s * (dx - 0.06), y + s * 0.14, s * 0.07, s * 0.035, -0.5, 0, 7); g.ellipse(x + s * (dx + 0.06), y + s * 0.12, s * 0.07, s * 0.035, 0.5, 0, 7); g.fill();
  }
  if (ready) { g.fillStyle = "#ffd35c"; g.beginPath(); g.arc(x + s * 0.9, y + s * 0.2, s * 0.12, 0, 7); g.fill(); g.fillStyle = "#7a4f2b"; g.font = `${Math.round(s * 0.2)}px Jua, sans-serif`; g.textAlign = "center"; g.fillText("!", x + s * 0.9, y + s * 0.27); }
}

export function drawPetHouse(g, x, y, w, h, s) {
  shadow(g, x + w / 2, y + h - s * 0.05, w * 0.46, s * 0.15);
  rr(g, x + s * 0.2, y + h * 0.42, w - s * 0.4, h * 0.55, s * 0.1); fs(g, "#7fb7d8", "#3f6f8e", 2);
  g.beginPath(); g.moveTo(x + s * 0.05, y + h * 0.48); g.lineTo(x + w / 2, y + s * 0.1); g.lineTo(x + w - s * 0.05, y + h * 0.48); g.closePath(); fs(g, "#f39a2b", "#a85e14", 2);
  const ax = x + w / 2, ay = y + h * 0.66;
  g.beginPath(); g.moveTo(ax - s * 0.38, y + h - s * 0.06); g.lineTo(ax - s * 0.38, ay); g.arc(ax, ay, s * 0.38, Math.PI, 0); g.lineTo(ax + s * 0.38, y + h - s * 0.06); g.closePath(); fs(g, "#2f2622");
  g.font = `${Math.round(s * 0.36)}px Jua, sans-serif`; g.textAlign = "center"; g.fillStyle = "#fffdf6";
  g.fillText("🐾", ax, y + h * 0.42);
}

// ---- 텃밭 칸: 흙 + 작물(stage 0 씨앗 / 1 싹 / 2 자람 / 3 다 자람) ----
export function drawSoil(g, x, y, s, wet) {
  rr(g, x + s * 0.06, y + s * 0.12, s * 0.88, s * 0.8, s * 0.18); fs(g, wet ? "#6b4a2e" : "#8a5f3a", "#5a3a20", 1.5);
  g.strokeStyle = "rgba(60,35,18,.4)"; g.lineWidth = 1.2;
  for (const k of [0.35, 0.55, 0.75]) { g.beginPath(); g.moveTo(x + s * 0.16, y + s * k); g.lineTo(x + s * 0.84, y + s * k); g.stroke(); }
}
const CROP = {
  carrot: { leaf: "#5fb35a", fruit: "#f39a2b" }, potato: { leaf: "#6fae4f", fruit: "#c8a46a" },
  tomato: { leaf: "#4f9d4a", fruit: "#e3463b" }, pumpkin: { leaf: "#5fa54f", fruit: "#f3a03a" },
};
export function drawCrop(g, x, y, s, crop, stage, t) {
  const c = CROP[crop] || CROP.carrot, cx = x + s / 2, base = y + s * 0.62;
  if (stage === 0) { g.fillStyle = "#5a3a20"; g.beginPath(); g.ellipse(cx, base, s * 0.18, s * 0.08, 0, 0, 7); g.fill(); g.fillStyle = "#e9d8a6"; for (const dx of [-0.07, 0.02, 0.09]) { g.beginPath(); g.arc(cx + dx * s, base - s * 0.02, s * 0.025, 0, 7); g.fill(); } return; }
  const sway = Math.sin(t * 2 + x) * s * 0.02;
  const leaf = (lx, ly, a, len) => { g.save(); g.translate(lx, ly); g.rotate(a); g.beginPath(); g.ellipse(0, -len / 2, len * 0.28, len / 2, 0, 0, 7); fs(g, c.leaf, "#2f6a2a", 1); g.restore(); };
  if (stage === 1) { leaf(cx + sway, base, -0.5, s * 0.22); leaf(cx + sway, base, 0.5, s * 0.22); return; }
  if (crop === "tomato" || crop === "pumpkin") {
    if (crop === "tomato") { g.strokeStyle = "#8a6a3a"; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(cx, base + s * 0.05); g.lineTo(cx, base - s * 0.55); g.stroke(); }
    for (const [a, l] of [[-0.9, 0.3], [0.9, 0.3], [-0.3, 0.38], [0.3, 0.38], [0, 0.42]]) leaf(cx + sway, base - (crop === "tomato" ? s * 0.1 : 0), a, s * l * (stage === 2 ? 0.8 : 1));
    if (stage === 3) {
      if (crop === "tomato") for (const [dx, dy] of [[-0.14, -0.3], [0.13, -0.22], [0, -0.45]]) { g.beginPath(); g.arc(cx + dx * s, base + dy * s, s * 0.1, 0, 7); fs(g, c.fruit, "#8a1f18", 1); g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.arc(cx + dx * s - s * 0.03, base + dy * s - s * 0.03, s * 0.025, 0, 7); g.fill(); }
      else { g.beginPath(); g.ellipse(cx, base - s * 0.08, s * 0.3, s * 0.22, 0, 0, 7); fs(g, c.fruit, "#a85e14", 1.5); g.strokeStyle = "rgba(168,94,20,.6)"; g.lineWidth = 1.2; for (const k of [-0.15, 0, 0.15]) { g.beginPath(); g.ellipse(cx + k * s, base - s * 0.08, s * 0.08, s * 0.21, 0, 0, 7); g.stroke(); } g.fillStyle = "#4f7a2a"; g.fillRect(cx - s * 0.03, base - s * 0.34, s * 0.06, s * 0.08); }
    }
  } else {
    for (const [a, l] of [[-0.6, 0.32], [0, 0.4], [0.6, 0.32]]) leaf(cx + sway, base, a, s * l * (stage === 2 ? 0.8 : 1));
    if (stage === 3) {
      if (crop === "carrot") { g.beginPath(); g.moveTo(cx - s * 0.12, base - s * 0.02); g.lineTo(cx + s * 0.12, base - s * 0.02); g.lineTo(cx, base + s * 0.22); g.closePath(); fs(g, c.fruit, "#a85e14", 1.2); }
      else for (const dx of [-0.13, 0.13]) { g.beginPath(); g.ellipse(cx + dx * s, base + s * 0.08, s * 0.12, s * 0.09, 0, 0, 7); fs(g, c.fruit, "#8a6a3a", 1.2); }
    }
  }
  if (stage === 3) { const k = (Math.sin(t * 4 + x) + 1) / 2; g.fillStyle = `rgba(255,240,150,${0.5 + 0.5 * k})`; for (const [dx, dy] of [[-0.3, -0.5], [0.32, -0.38]]) { const px = cx + dx * s, py = base + dy * s, r = s * (0.05 + 0.03 * k); g.beginPath(); g.moveTo(px, py - r * 2); g.lineTo(px + r * 0.5, py - r * 0.5); g.lineTo(px + r * 2, py); g.lineTo(px + r * 0.5, py + r * 0.5); g.lineTo(px, py + r * 2); g.lineTo(px - r * 0.5, py + r * 0.5); g.lineTo(px - r * 2, py); g.lineTo(px - r * 0.5, py - r * 0.5); g.closePath(); g.fill(); } }
}
export function drawDrops(g, x, y, s, n) {
  g.fillStyle = "#5aa0d0";
  for (let i = 0; i < n; i++) { const px = x + s * (0.12 + i * 0.16), py = y + s * 0.1; g.beginPath(); g.moveTo(px, py - s * 0.08); g.quadraticCurveTo(px + s * 0.06, py, px, py + s * 0.04); g.quadraticCurveTo(px - s * 0.06, py, px, py - s * 0.08); g.fill(); }
}

// ---- 애완동물: dog·cat·rabbit, dir 1 왼쪽 2 오른쪽(0·3은 마지막 좌우 유지), hop = 깡충(0~1) ----
const PET = {
  dog: { body: "#c8955f", dark: "#8a5f3a", light: "#f1dcc0" },
  cat: { body: "#f0a54f", dark: "#c9752a", light: "#fff1dd" },
  rabbit: { body: "#f4f0ea", dark: "#c9bfb3", light: "#ffd6df" },
};
export function drawPet(g, kind, cx, cy, s, faceLeft, t, moving, hop) {
  const c = PET[kind] || PET.dog;
  const jump = (moving ? Math.abs(Math.sin(t * 9)) * s * 0.05 : 0) + (kind === "rabbit" && moving ? Math.abs(Math.sin(t * 6)) * s * 0.08 : 0) + hop * s * 0.25;
  if (ANI[kind]) { shadow(g, cx, cy, s * 0.26, s * 0.07); drawAni(g, ANI[kind], cx, cy - jump, s * (kind === "rabbit" ? 0.62 : 0.55), faceLeft, moving ? Math.sin(t * 12) * 0.06 : 0, moving ? 0 : Math.sin(t * 2.5) * 0.015); return; }
  shadow(g, cx, cy, s * 0.26, s * 0.07);
  g.save(); g.translate(cx, cy - jump); if (faceLeft) g.scale(-1, 1);
  const legs = moving ? Math.sin(t * 12) * s * 0.03 : 0;
  g.fillStyle = c.dark; for (const [lx, o] of [[-0.14, legs], [-0.05, -legs], [0.07, legs], [0.15, -legs]]) { rr(g, lx * s, -s * 0.12 + o * 0.3, s * 0.06, s * 0.12, s * 0.02); g.fill(); }
  g.beginPath(); g.ellipse(0, -s * 0.18, s * 0.24, s * 0.12, 0, 0, 7); fs(g, c.body, c.dark, 1.2);                         // 몸
  if (kind === "cat") { g.strokeStyle = c.body; g.lineWidth = s * 0.06; g.lineCap = "round"; g.beginPath(); g.moveTo(-s * 0.22, -s * 0.2); g.quadraticCurveTo(-s * 0.36, -s * 0.3, -s * 0.3, -s * (0.45 + Math.sin(t * 3) * 0.04)); g.stroke(); }
  else if (kind === "dog") { g.strokeStyle = c.dark; g.lineWidth = s * 0.05; g.lineCap = "round"; g.beginPath(); g.moveTo(-s * 0.22, -s * 0.22); g.lineTo(-s * 0.32, -s * (0.32 + (moving ? Math.sin(t * 14) * 0.05 : 0))); g.stroke(); }
  else { g.beginPath(); g.arc(-s * 0.24, -s * 0.2, s * 0.06, 0, 7); fs(g, "#ffffff", c.dark, 1); }
  const hx = s * 0.2, hy = -s * 0.3;
  if (kind === "rabbit") for (const ex of [-0.05, 0.05]) { g.beginPath(); g.ellipse(hx + ex * s, hy - s * 0.2, s * 0.045, s * 0.13, ex * 3, 0, 7); fs(g, c.body, c.dark, 1); g.beginPath(); g.ellipse(hx + ex * s, hy - s * 0.2, s * 0.02, s * 0.08, ex * 3, 0, 7); fs(g, c.light); }
  if (kind === "cat") for (const ex of [-0.08, 0.06]) { g.beginPath(); g.moveTo(hx + ex * s - s * 0.04, hy - s * 0.06); g.lineTo(hx + ex * s, hy - s * 0.2); g.lineTo(hx + ex * s + s * 0.05, hy - s * 0.06); g.closePath(); fs(g, c.body, c.dark, 1); }
  g.beginPath(); g.arc(hx, hy, s * 0.13, 0, 7); fs(g, c.body, c.dark, 1.2);                                               // 머리
  if (kind === "dog") { g.beginPath(); g.ellipse(hx - s * 0.07, hy - s * 0.02, s * 0.05, s * 0.1, 0.4, 0, 7); fs(g, c.dark); }   // 늘어진 귀
  g.beginPath(); g.ellipse(hx + s * 0.08, hy + s * 0.04, s * 0.06, s * 0.045, 0, 0, 7); fs(g, c.light);                  // 주둥이
  g.fillStyle = "#24352a"; g.beginPath(); g.arc(hx + s * 0.05, hy - s * 0.03, s * 0.022, 0, 7); g.fill();
  g.beginPath(); g.arc(hx + s * 0.13, hy + s * 0.025, s * 0.02, 0, 7); g.fill();                                          // 코
  g.fillStyle = "rgba(255,130,150,.45)"; g.beginPath(); g.arc(hx + s * 0.02, hy + s * 0.05, s * 0.025, 0, 7); g.fill();  // 볼
  g.restore();
}
// 머리 위 하트(쓰다듬기·모이)
export function drawHearts(g, cx, cy, s, p) {
  g.save(); g.globalAlpha = Math.max(0, 1 - p); g.fillStyle = "#ff6f8e";
  for (const [dx, k] of [[-0.12, 0], [0.12, 0.25]]) {
    const y = cy - s * (0.1 + (p + k) * 0.5), x = cx + dx * s, r = s * 0.07;
    g.beginPath(); g.moveTo(x, y + r * 1.2); g.bezierCurveTo(x - r * 2, y - r * 0.4, x - r * 0.6, y - r * 1.6, x, y - r * 0.5); g.bezierCurveTo(x + r * 0.6, y - r * 1.6, x + r * 2, y - r * 0.4, x, y + r * 1.2); g.fill();
  }
  g.restore();
}

// ---- 버전 8: 양 우리·양·게시판 ----
// 양 우리: 낮은 나무 울타리(사각형 둘레) + 바닥 풀빛
export function drawPen(g, x, y, w, h, TS) {
  g.save();
  g.fillStyle = "rgba(170,210,120,.35)"; rr(g, x + TS * 0.15, y + TS * 0.15, w - TS * 0.3, h - TS * 0.3, TS * 0.3); g.fill();
  g.strokeStyle = "#a77b4f"; g.lineWidth = Math.max(2, TS * 0.08);
  for (const off of [0.22, 0.42]) { rr(g, x + TS * 0.2, y + TS * off, w - TS * 0.4, h - TS * 0.62, TS * 0.12); g.stroke(); }
  g.fillStyle = "#8a5f3a";
  for (let i = 0; i <= w / TS; i++) for (const yy of [y + TS * 0.05, y + h - TS * 0.5]) g.fillRect(x + TS * 0.2 + i * (w - TS * 0.4) / (w / TS) - TS * 0.06, yy, TS * 0.12, TS * 0.4);
  g.restore();
}
// 양: 털이 많으면 둥근 구름 몸, 깎았으면 작은 몸. flip = 왼쪽 보기
export function drawSheep(g, cx, cy, s, flip, t, sheared, munch) {
  const sImg = sheared ? ANI.sheep_sheared : ANI.sheep;
  if (sImg) { shadow(g, cx, cy + s * 0.02, s * 0.32, s * 0.08); drawAni(g, sImg, cx, cy, s * (sheared ? 0.72 : 0.82), flip, munch ? Math.max(0, Math.sin(t * 6)) * 0.12 : 0, Math.sin(t * 2.4) * 0.02); return; }
  g.save(); g.translate(cx, cy); if (flip) g.scale(-1, 1);
  shadow(g, 0, s * 0.02, s * 0.32, s * 0.08);
  g.fillStyle = "#4b3a32"; for (const lx of [-0.16, -0.06, 0.08, 0.17]) g.fillRect(lx * s, -s * 0.13, s * 0.05, s * 0.13);   // 다리
  const k = sheared ? 0.72 : 1, wob = Math.sin(t * 2.4) * s * 0.01;
  if (sheared) { g.beginPath(); g.ellipse(0, -s * 0.24, s * 0.24, s * 0.15, 0, 0, 7); fs(g, "#f4e7d8", "#d1bfa8", 1.2); }
  else for (const [u, v, r] of [[-0.2, -0.24, 0.13], [-0.07, -0.32, 0.15], [0.08, -0.31, 0.14], [0.18, -0.22, 0.12], [0, -0.18, 0.16], [-0.14, -0.15, 0.11], [0.12, -0.14, 0.11]]) {
    g.beginPath(); g.arc(u * s, v * s + wob, r * s, 0, 7); fs(g, "#fffdf8", "#ddd3c4", 1);
  }
  const hx = s * 0.27 * k + s * 0.04, hy = -s * 0.3 + (munch ? Math.max(0, Math.sin(t * 6)) * s * 0.08 : 0);
  g.beginPath(); g.ellipse(hx, hy, s * 0.1, s * 0.12, 0.3, 0, 7); fs(g, "#5a463c");                                    // 얼굴
  g.beginPath(); g.ellipse(hx - s * 0.06, hy - s * 0.08, s * 0.07, s * 0.035, -0.5, 0, 7); fs(g, "#5a463c");            // 귀
  if (!sheared) { g.beginPath(); g.arc(hx - s * 0.02, hy - s * 0.1, s * 0.06, 0, 7); fs(g, "#fffdf8", "#ddd3c4", 1); }   // 앞머리 털
  g.fillStyle = "#fff"; g.beginPath(); g.arc(hx + s * 0.04, hy - s * 0.01, s * 0.022, 0, 7); g.fill();
  g.fillStyle = "#1d1410"; g.beginPath(); g.arc(hx + s * 0.045, hy - s * 0.01, s * 0.012, 0, 7); g.fill();
  g.restore();
}
// 게시판: 기둥 둘 + 나무 판 + 종이 쪽지(부탁 수만큼, 최대 4장)
export function drawBoard(g, x, y, TS, notes, glow) {
  g.save();
  g.fillStyle = "#7a4f2b"; g.fillRect(x + TS * 0.12, y - TS * 0.2, TS * 0.1, TS * 1.1); g.fillRect(x + TS * 0.78, y - TS * 0.2, TS * 0.1, TS * 1.1);
  rr(g, x - TS * 0.05, y - TS * 0.75, TS * 1.1, TS * 0.8, TS * 0.08); fs(g, "#c99b62", "#6e4325", Math.max(1.5, TS * 0.05));
  g.fillStyle = "#a77b4f"; g.fillRect(x - TS * 0.05, y - TS * 0.82, TS * 1.1, TS * 0.12);
  const spots = [[0.05, -0.65], [0.55, -0.62], [0.12, -0.32], [0.58, -0.3]];
  for (let i = 0; i < Math.min(4, notes); i++) {
    const [u, v] = spots[i]; g.save(); g.translate(x + TS * u, y + TS * v); g.rotate((i % 2 ? 0.08 : -0.07));
    g.fillStyle = "#fffaf0"; g.fillRect(0, 0, TS * 0.36, TS * 0.26); g.fillStyle = "#e3463b"; g.beginPath(); g.arc(TS * 0.18, TS * 0.03, TS * 0.035, 0, 7); g.fill();
    g.fillStyle = "rgba(80,60,40,.5)"; g.fillRect(TS * 0.05, TS * 0.11, TS * 0.25, TS * 0.03); g.fillRect(TS * 0.05, TS * 0.17, TS * 0.18, TS * 0.03);
    g.restore();
  }
  if (glow) { g.fillStyle = "#ffd35c"; g.beginPath(); g.arc(x + TS * 0.95, y - TS * 0.78, TS * 0.13, 0, 7); g.fill(); g.fillStyle = "#4f2f19"; g.font = `${Math.round(TS * 0.2)}px Jua, sans-serif`; g.textAlign = "center"; g.fillText("!", x + TS * 0.95, y - TS * 0.71); }
  g.restore();
}
