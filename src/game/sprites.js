// 1-A 임시 그림: 코드로 그린 16px 도트 그림 (1-B에서 무료 그림 자료로 바꿈)
import { T } from "./world.js";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

const TILE_COL = {
  [T.SEA]: ["#4aa9c9", "#57b6d4"], [T.SAND]: ["#f0dca4", "#e8d095"], [T.GRASS]: ["#86c463", "#7ab857"],
  [T.RIVER]: ["#58bcd6", "#66c6dd"], [T.PATH]: ["#d8bf8a", "#ccb07a"], [T.POND]: ["#5dc0cc", "#6bcad4"],
  [T.BRIDGE]: ["#a77b4f", "#8a6440"], [T.ROCK]: ["#8d8f94", "#777a80"],
};

// PixelLab 바닥 타일(art/ground). 못 불러오면 아래 코드 그림으로 그린다
let GROUND = null;
const GROUND_CLASS = { [T.SEA]: "sea", [T.SAND]: "sand", [T.GRASS]: "grass", [T.ROCK]: "grass", [T.PATH]: "path", [T.RIVER]: "lake", [T.POND]: "lake", [T.BRIDGE]: "lake" };
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
export async function loadGroundArt() {
  try {
    const r = await fetch("art/ground/ground.json"); if (!r.ok) return;
    const j = await r.json();
    for (const s of Object.values(j.sets)) s.image = await loadImg("art/ground/" + s.img);
    GROUND = j;
  } catch (e) { GROUND = null; }
}
// PixelLab 물건 그림(art/obj): 불러오면 아래 코드 그림 캔버스를 그 그림으로 다시 칠한다(못 불러오면 코드 그림 그대로)
export let OBJ_ART = false;
export async function loadArt() {
  await Promise.all([loadGroundArt(), loadObjArt(), loadIcons()]);
}
// 아이템 그림 아이콘(art/icon/<id>.png). 목록에 없으면 이모지 그대로
const ICONS = new Set();
async function loadIcons() {
  try { const r = await fetch("art/icon/list.json"); if (r.ok) for (const k of await r.json()) ICONS.add(k); } catch (e) { /* 이모지로 */ }
}
export function iconHtml(id, emoji) {
  return ICONS.has(id) ? `<img class="pxi" src="art/icon/${id}.png" alt="${emoji || ""}" draggable="false">` : (emoji || "");
}
async function loadObjArt() {
  const TARGET = { tree: SPR.tree, fruitApple: SPR.fruitApple, fruitOrange: SPR.fruitOrange, rock: SPR.rock, shell: SPR.shell, weed: SPR.weed,
    flower_red: SPR.flower.red, flower_yellow: SPR.flower.yellow, flower_white: SPR.flower.white,
    stone: FORAGE_SPR.stone, mushroom_red: FORAGE_SPR.mushroom_red, mushroom_brown: FORAGE_SPR.mushroom_brown, mushroom_white: FORAGE_SPR.mushroom_white,
    herb_mint: FORAGE_SPR.herb_mint, herb_chamomile: FORAGE_SPR.herb_chamomile, twig: TWIG_SPR,
    apple: DROP_SPR.apple, orange: DROP_SPR.orange, honeycomb: DROP_SPR.honeycomb };
  try {
    const imgs = await Promise.all(Object.keys(TARGET).map(k => loadImg("art/obj/" + k + ".png")));
    Object.values(TARGET).forEach((c, i) => { c.width = imgs[i].width; c.height = imgs[i].height; c.getContext("2d").drawImage(imgs[i], 0, 0); });
    OBJ_ART = true;
  } catch (e) { OBJ_ART = false; }
}
// 두 지형 사이 타일 세트 찾기(없으면 null)
function pairSet(a, b) {
  for (const s of Object.values(GROUND.sets)) if ((s.lower === a && s.upper === b) || (s.lower === b && s.upper === a)) return s;
  return null;
}
// 세트가 없는 조합은 드물게 나오는 쪽을 가까운 지형으로 바꿔 두 지형으로 줄인다
function fitCorners(cs) {
  cs = cs.slice();
  for (let n = 0; n < 4; n++) {
    const kinds = [...new Set(cs)];
    if (kinds.length === 1 || (kinds.length === 2 && pairSet(kinds[0], kinds[1]))) return cs;
    const has = k => kinds.includes(k);
    const swap = has("path") ? ["path", "grass"] : has("lake") ? ["lake", has("sea") || (has("sand") && !has("grass")) ? "sea" : "grass"] : has("sea") && has("grass") && !has("sand") ? ["grass", "sand"] : ["sand", "grass"];
    cs = cs.map(c => c === swap[0] ? swap[1] : c);
  }
  return cs;
}
function renderGroundArt(world) {
  const S = 16, c = cv(world.w * S, world.h * S), g = c.getContext("2d");
  const cls = (x, y) => GROUND_CLASS[world.tile(x, y)] || "sea";
  // 꼭짓점마다 타일 1장: 둘레 4칸의 지형이 타일 네 모서리(칸 경계가 타일 한가운데로 와서 칸 단위 지도가 그대로 맞음)
  for (let vy = 0; vy <= world.h; vy++) for (let vx = 0; vx <= world.w; vx++) {
    const cs = fitCorners([cls(vx - 1, vy - 1), cls(vx, vy - 1), cls(vx - 1, vy), cls(vx, vy)]);
    const kinds = [...new Set(cs)];
    let set, key;
    if (kinds.length === 1) {
      const h = (vx * 73856093 ^ vy * 19349663) >>> 0;
      const sets = Object.values(GROUND.sets).filter(s => s.lower === kinds[0] || s.upper === kinds[0]);
      set = sets[kinds[0] === "grass" ? 0 : h % sets.length];
      key = set.upper === kinds[0] ? "1111" : "0000";
    } else {
      set = pairSet(kinds[0], kinds[1]);
      key = cs.map(k => k === set.upper ? 1 : 0).join("");
    }
    const [tx, ty] = set.tiles[key];
    g.drawImage(set.image, tx, ty, S, S, vx * S - S / 2, vy * S - S / 2, S, S);
  }
  // 다리·바위는 그 칸 위에 덧그림
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const t = world.tile(x, y);
    if (t === T.BRIDGE) { px(g, "#a77b4f", x * S, y * S, S, S); for (let k = 0; k < S; k += 4) px(g, "#8a6440", x * S + k, y * S, 1, S); px(g, "#6d4c30", x * S, y * S, S, 1); px(g, "#6d4c30", x * S, y * S + S - 1, S, 1); }
    if (t === T.ROCK) { px(g, "rgba(0,0,0,.18)", x * S + 2, y * S + 12, 12, 2); px(g, "#8d8f94", x * S + 2, y * S + 4, 12, 9); px(g, "#a2a5aa", x * S + 3, y * S + 3, 9, 5); px(g, "#c4c7cc", x * S + 5, y * S + 4, 4, 2); }
  }
  return c;
}

// 섬 전체 바닥을 한 장으로 미리 그린다(1칸=16px)
export function renderGround(world) {
  if (GROUND) return renderGroundArt(world);
  const S = 16, c = cv(world.w * S, world.h * S), g = c.getContext("2d");
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const t = world.tile(x, y), [a, b] = TILE_COL[t] || TILE_COL[T.SEA];
    px(g, a, x * S, y * S, S, S);
    const h = (x * 73856093 ^ y * 19349663) >>> 0;
    if (t === T.GRASS && h % 5 === 0) { px(g, b, x * S + (h % 11), y * S + (h % 13), 1, 3); px(g, b, x * S + (h % 11) + 2, y * S + (h % 13) + 1, 1, 2); }
    if (t === T.SAND && h % 7 === 0) px(g, b, x * S + (h % 13), y * S + (h % 11), 1, 1);
    if (t === T.BRIDGE) { for (let k = 0; k < S; k += 4) px(g, b, x * S + k, y * S, 1, S); px(g, "#6d4c30", x * S, y * S, S, 1); px(g, "#6d4c30", x * S, y * S + S - 1, S, 1); }
    if (t === T.ROCK) { px(g, "#a2a5aa", x * S + 3, y * S + 3, 6, 4); }
    // 물가 테두리
    const water = t === T.SEA || t === T.RIVER || t === T.POND;
    if (!water) {
      const n = world.tile(x, y - 1); if (n === T.SEA || n === T.RIVER || n === T.POND) px(g, "rgba(255,255,255,.35)", x * S, y * S, S, 1);
    } else if (h % 9 === 0) { px(g, "rgba(255,255,255,.35)", x * S + 4, y * S + 7, 5, 1); }
  }
  return c;
}

function sprite(w, h, draw) { const c = cv(w, h); draw(c.getContext("2d")); return c; }

export const SPR = {
  tree: sprite(16, 24, g => { px(g, "#7a4e2c", 7, 15, 3, 8); px(g, "#2f7d3c", 2, 3, 12, 11); px(g, "#3f9a4b", 3, 1, 10, 11); px(g, "#56b05f", 5, 2, 5, 4); px(g, "#2f7d3c", 1, 6, 14, 6); }),
  fruitApple: sprite(16, 24, g => { for (const [x, y] of [[4, 6], [10, 5], [7, 10]]) { px(g, "#e3463b", x, y, 2, 2); px(g, "#ff8a7f", x, y, 1, 1); } }),
  fruitOrange: sprite(16, 24, g => { for (const [x, y] of [[4, 6], [10, 5], [7, 10]]) { px(g, "#f39a2b", x, y, 2, 2); px(g, "#ffc777", x, y, 1, 1); } }),
  rock: sprite(16, 16, g => { px(g, "#7d8086", 2, 6, 12, 8); px(g, "#9a9da3", 3, 5, 9, 6); px(g, "#b9bcc1", 5, 6, 4, 2); }),
  shell: sprite(16, 16, g => { px(g, "#f8dccd", 5, 8, 6, 4); px(g, "#f8dccd", 6, 7, 4, 1); px(g, "#d9a690", 7, 8, 1, 4); px(g, "#d9a690", 9, 8, 1, 4); }),
  weed: sprite(16, 16, g => { px(g, "#4f9a3c", 5, 8, 1, 5); px(g, "#4f9a3c", 7, 6, 1, 7); px(g, "#4f9a3c", 9, 8, 1, 5); px(g, "#3d7f2e", 6, 10, 1, 3); px(g, "#3d7f2e", 8, 9, 1, 4); }),
  flower: {},
  bench: sprite(16, 16, g => { px(g, "#8a5a3a", 1, 6, 14, 9); px(g, "#b07a4c", 0, 4, 16, 3); px(g, "#6d6d6d", 9, 1, 2, 4); px(g, "#a0a0a0", 7, 1, 6, 2); }),
};
for (const [k, col] of Object.entries({ red: "#ff6f8e", yellow: "#ffd35c", white: "#ffffff" })) {
  SPR.flower[k] = sprite(16, 16, g => { px(g, "#3d8a3a", 7, 9, 1, 5); px(g, col, 6, 5, 3, 3); px(g, col, 5, 6, 5, 1); px(g, col, 7, 4, 1, 5); px(g, "#e8a33c", 7, 6, 1, 1); });
}
// 버섯·약초(v2)
const mush = (cap, dot) => sprite(16, 16, g => { px(g, "#f3ead8", 7, 9, 3, 5); px(g, cap, 4, 5, 9, 4); px(g, cap, 5, 4, 7, 1); if (dot) { px(g, dot, 6, 6, 1, 1); px(g, dot, 10, 5, 1, 1); px(g, dot, 9, 7, 1, 1); } px(g, "rgba(0,0,0,.15)", 5, 14, 7, 1); });
export const FORAGE_SPR = {
  stone: sprite(16, 16, g => { px(g, "rgba(0,0,0,.18)", 3, 13, 11, 1); px(g, "#8d8f94", 3, 9, 6, 4); px(g, "#b9bcc2", 4, 9, 3, 1); px(g, "#7a7c82", 9, 10, 5, 3); px(g, "#a5a8ae", 10, 10, 2, 1); px(g, "#9a9da3", 6, 6, 4, 3); px(g, "#c9ccd1", 7, 6, 2, 1); }),   // 돌밭 돌멩이
  mushroom_red: mush("#e3463b", "#fff"),
  mushroom_brown: mush("#9a6a42", "#c79a6e"),
  mushroom_white: mush("#f4f1ea", "#d9d2c4"),
  herb_mint: sprite(16, 16, g => { px(g, "#3d8a3a", 7, 8, 1, 6); for (const [x, y] of [[4, 6], [9, 5], [5, 9], [9, 9]]) { px(g, "#5fc46a", x, y, 3, 2); px(g, "#86d98e", x, y, 1, 1); } }),
  herb_chamomile: sprite(16, 16, g => { px(g, "#3d8a3a", 7, 8, 1, 6); px(g, "#3d8a3a", 10, 9, 1, 5); for (const [cx, cy] of [[7, 6], [10, 8]]) { px(g, "#fff", cx - 1, cy, 3, 1); px(g, "#fff", cx, cy - 1, 1, 3); px(g, "#ffd35c", cx, cy, 1, 1); } }),
};
// 나뭇가지(나무 밑동, 오늘 내가 아직 안 받은 나무에만)
export const TWIG_SPR = sprite(16, 16, g => { px(g, "rgba(0,0,0,.18)", 2, 13, 12, 1); px(g, "#6e4325", 2, 10, 12, 2); px(g, "#b07a46", 3, 10, 6, 1); px(g, "#6e4325", 5, 7, 2, 3); px(g, "#6e4325", 10, 6, 2, 4); px(g, "#5fb35a", 11, 4, 3, 2); px(g, "#5fb35a", 4, 5, 2, 2); px(g, "#7fd07a", 12, 4, 1, 1); });
export const DROP_SPR = {
  apple: sprite(16, 16, g => { px(g, "#e3463b", 6, 7, 4, 4); px(g, "#ff8a7f", 7, 8, 1, 1); px(g, "#5a3a1e", 8, 6, 1, 1); }),
  orange: sprite(16, 16, g => { px(g, "#f39a2b", 6, 7, 4, 4); px(g, "#ffc777", 7, 8, 1, 1); px(g, "#3d7f2e", 8, 6, 1, 1); }),
  // 벌집(v3): 육각 칸 무늬
  honeycomb: (() => { const c = cv(32, 32), g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(16, 27, 10, 3, 0, 0, 7); g.fill();
    g.fillStyle = "#e9a82c"; g.beginPath(); g.ellipse(16, 17, 11, 10, 0, 0, 7); g.fill(); g.strokeStyle = "#a8701a"; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = "#c98a1f"; g.lineWidth = 1;
    for (const [x, y] of [[11, 13], [17, 13], [14, 18], [20, 18], [11, 22], [17, 22]]) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); } g.closePath(); g.stroke(); }
    g.fillStyle = "#ffd76a"; g.beginPath(); g.ellipse(13, 12, 3, 2, -0.5, 0, 7); g.fill();
    return c; })(),
};

// 사람: 색 + 방향, 걷는 동작 2장
const personCache = new Map();
export function personSprite(color, dir, step) {
  const key = color + dir + step;
  if (personCache.has(key)) return personCache.get(key);
  const s = sprite(16, 20, g => {
    px(g, "rgba(0,0,0,.18)", 4, 18, 8, 2);
    px(g, color, 4, 10, 8, 6);                       // 몸
    px(g, step ? "#4a3a2a" : "#4a3a2a", step ? 4 : 5, 16, 3, 2); px(g, "#4a3a2a", step ? 9 : 8, 16, 3, 2);
    px(g, "#ffe0bd", 4, 3, 8, 7);                     // 얼굴
    px(g, "#4a3424", 4, 2, 8, 3); px(g, "#4a3424", 3, 3, 1, 4); px(g, "#4a3424", 12, 3, 1, 4);
    if (dir === 3) px(g, "#4a3424", 4, 3, 8, 6);       // 뒤
    else {
      const ox = dir === 1 ? -1 : dir === 2 ? 1 : 0;
      px(g, "#222", 6 + ox, 6, 1, 2); px(g, "#222", 9 + ox, 6, 1, 2);
      px(g, "#f2a3a3", 5 + ox, 8, 1, 1); px(g, "#f2a3a3", 10 + ox, 8, 1, 1);
    }
  });
  personCache.set(key, s);
  return s;
}

export function houseSprite(color, label) {
  return sprite(6 * 16, 5 * 16 + 14, g => {
    const W = 96, top = 14;
    px(g, "#f6efe0", 6, top + 26, W - 12, 80 - 26);
    px(g, "#e3d8c2", 6, top + 74, W - 12, 6);
    g.fillStyle = color; g.beginPath(); g.moveTo(0, top + 30); g.lineTo(W / 2, top - 6); g.lineTo(W, top + 30); g.closePath(); g.fill();
    px(g, "rgba(0,0,0,.15)", 0, top + 28, W, 3);
    px(g, "#bfe3ef", 14, top + 40, 14, 12); px(g, "#bfe3ef", W - 28, top + 40, 14, 12);
    px(g, "#ffffff", 20, top + 40, 2, 12); px(g, "#ffffff", W - 22, top + 40, 2, 12);
    px(g, "#8a5a3a", 40, top + 50, 16, 30); px(g, "#e8c25a", 52, top + 64, 2, 2);
    g.font = "bold 11px sans-serif"; g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText(label, W / 2, top + 22);
  });
}

// 가구(1-A 임시): 종류마다 색 블록 + 무늬
const FURN_STYLE = {
  chair_wood: ["#b07a4c", "#8a5a3a"], pot_flower: ["#c96f4a", "#ff6f8e"], table_wood: ["#c08a58", "#8a5a3a"],
  bed_log: ["#a8754a", "#f4f0ff"], lamp_shell: ["#f8dccd", "#ffe9a6"], bookshelf_wood: ["#8a5a3a", "#5aa0d0"],
};
const furnCache = new Map();
export function furnSprite(type, w, h) {
  const key = type + w + h;
  if (furnCache.has(key)) return furnCache.get(key);
  const [a, b] = FURN_STYLE[type] || ["#999", "#666"];
  const s = sprite(w * 16, h * 16, g => {
    px(g, "rgba(0,0,0,.15)", 1, h * 16 - 3, w * 16 - 2, 3);
    px(g, a, 2, 2, w * 16 - 4, h * 16 - 5);
    px(g, b, 4, 4, w * 16 - 8, Math.max(3, (h * 16 - 10) / 2));
    px(g, "rgba(255,255,255,.25)", 2, 2, w * 16 - 4, 2);
  });
  furnCache.set(key, s);
  return s;
}
