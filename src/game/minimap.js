// 미니맵: 섬 바탕은 한 번만 그려 두고(1칸=1px), 점·집만 매번 그린다
import { T } from "./world.js";

const COL = { [T.SEA]: "#4aa9c9", [T.SAND]: "#f0dca4", [T.GRASS]: "#86c463", [T.RIVER]: "#58bcd6", [T.PATH]: "#d8bf8a", [T.POND]: "#5dc0cc", [T.BRIDGE]: "#a77b4f", [T.ROCK]: "#8d8f94" };

export function renderMapBase(world) {
  const c = document.createElement("canvas"); c.width = world.w; c.height = world.h;
  const g = c.getContext("2d"), img = g.createImageData(world.w, world.h);
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const cache = {};
  for (let i = 0; i < world.w * world.h; i++) {
    const t = world.tiles[i], [r, gg, b] = cache[t] || (cache[t] = rgb(COL[t] || COL[T.SEA]));
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // 숲은 조금 진하게
  g.fillStyle = "rgba(47,125,60,.55)";
  for (const o of world.objects) if (o.k === "tree") g.fillRect(o.x, o.y, 1, 1);
  return c;
}

// g에 (x,y,w,h) 칸으로 지도를 그림. markers = [{mid,x,y,inHouse}], me = {x,y}, colorOf(mid), nameOf(mid), big = 이름 표시
// extra = { camp:{x,y}, labels:[{text,x,y}] } (v3: 캠프파이어 자리, 큰 지도의 장소 글자)
// 큰 지도 글자는 겹치지 않게: 중요한 것(나 > 가족 > 캠프 > 집 > 장소)부터 놓고, 자리가 없으면 위·오른쪽·왼쪽으로 옮기거나 생략
export function drawMap(g, base, world, x, y, w, h, markers, me, myMid, colorOf, nameOf, big, extra = {}) {
  const sc = Math.min(w / world.w, h / world.h), ox = x + (w - world.w * sc) / 2, oy = y + (h - world.h * sc) / 2;
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(base, ox, oy, world.w * sc, world.h * sc);
  const labels = [];   // {text, px, py, r, col, bg, pri}
  // 캠프파이어 불 모양
  if (extra.camp) {
    const cx = ox + (extra.camp.x + 0.5) * sc, cy = oy + (extra.camp.y + 0.5) * sc, r = big ? 7 : 3.5;
    g.fillStyle = "#f7941d"; g.strokeStyle = "#fff"; g.lineWidth = big ? 2 : 1;
    g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.quadraticCurveTo(cx + r, cy - r * 0.2, cx + r * 0.6, cy + r * 0.7); g.lineTo(cx - r * 0.6, cy + r * 0.7); g.quadraticCurveTo(cx - r, cy - r * 0.2, cx, cy - r * 1.4); g.fill(); g.stroke();
    g.fillStyle = "#ffe066"; g.beginPath(); g.arc(cx, cy + r * 0.2, r * 0.35, 0, 7); g.fill();
    labels.push({ text: "캠프파이어", px: cx, py: cy, r, col: "#c0561b", pri: 2 });
  }
  // 집
  for (const hs of world.houses) {
    g.fillStyle = colorOf(hs.mid); g.strokeStyle = "#fff"; g.lineWidth = big ? 2 : 1;
    const hx = ox + (hs.x + hs.w / 2) * sc, hy = oy + (hs.y + hs.h / 2) * sc, r = Math.max(3, sc * 2.2);
    g.beginPath(); g.moveTo(hx, hy - r); g.lineTo(hx + r, hy); g.lineTo(hx + r * .7, hy); g.lineTo(hx + r * .7, hy + r * .8); g.lineTo(hx - r * .7, hy + r * .8); g.lineTo(hx - r * .7, hy); g.lineTo(hx - r, hy); g.closePath(); g.fill(); g.stroke();
    labels.push({ text: nameOf(hs.mid) + "네", px: hx, py: hy, r, col: "#24352a", pri: 3 });
  }
  // 가족 점
  const dot = (px, py, col, mine, label) => {
    const r = big ? 7 : 3.5;
    g.fillStyle = col; g.strokeStyle = mine ? "#24352a" : "#fff"; g.lineWidth = mine ? (big ? 3 : 2) : (big ? 2 : 1.2);
    g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    if (label) labels.push({ text: label, px, py, r, col, pri: mine ? 0 : 1 });
  };
  for (const m of markers) dot(ox + m.x * sc, oy + m.y * sc, colorOf(m.mid), false, nameOf(m.mid) + (m.inHouse ? "(집 안)" : ""));
  if (me) dot(ox + me.x * sc, oy + me.y * sc, colorOf(myMid), true, "나");
  for (const l of extra.labels || []) labels.push({ text: l.text, px: ox + l.x * sc, py: oy + l.y * sc, r: 0, col: "#2f5d3a", pri: 4 });
  if (big) {
    g.font = "13px Jua, sans-serif"; g.textAlign = "center";
    const used = [], H = 17;
    const hit = b => used.some(u => b.x < u.x + u.w && u.x < b.x + b.w && b.y < u.y + u.h && u.y < b.y + b.h);
    for (const l of labels.sort((a, b) => a.pri - b.pri)) {
      const tw = g.measureText(l.text).width + 8;
      const tries = l.r ? [[0, l.r + 2], [0, -l.r - H - 2], [l.r + 2 + tw / 2, -H / 2], [-l.r - 2 - tw / 2, -H / 2]] : [[0, -H / 2]];
      for (const [dx, dy] of tries) {
        const b = { x: l.px + dx - tw / 2, y: l.py + dy, w: tw, h: H };
        if (hit(b)) continue;
        used.push(b);
        g.fillStyle = "rgba(255,253,246,.9)"; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 6); g.fill();
        g.fillStyle = l.col; g.fillText(l.text, b.x + b.w / 2, b.y + 13);
        break;
      }
    }
  }
  g.restore();
}
