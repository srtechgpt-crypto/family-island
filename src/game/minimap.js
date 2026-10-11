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
export function drawMap(g, base, world, x, y, w, h, markers, me, myMid, colorOf, nameOf, big) {
  const sc = Math.min(w / world.w, h / world.h), ox = x + (w - world.w * sc) / 2, oy = y + (h - world.h * sc) / 2;
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(base, ox, oy, world.w * sc, world.h * sc);
  // 집
  for (const hs of world.houses) {
    g.fillStyle = colorOf(hs.mid); g.strokeStyle = "#fff"; g.lineWidth = big ? 2 : 1;
    const hx = ox + (hs.x + hs.w / 2) * sc, hy = oy + (hs.y + hs.h / 2) * sc, r = Math.max(3, sc * 2.2);
    g.beginPath(); g.moveTo(hx, hy - r); g.lineTo(hx + r, hy); g.lineTo(hx + r * .7, hy); g.lineTo(hx + r * .7, hy + r * .8); g.lineTo(hx - r * .7, hy + r * .8); g.lineTo(hx - r * .7, hy); g.lineTo(hx - r, hy); g.closePath(); g.fill(); g.stroke();
    if (big) { g.font = "13px Jua, sans-serif"; g.textAlign = "center"; g.fillStyle = "#24352a"; g.fillText(nameOf(hs.mid) + "네", hx, hy + r + 14); }
  }
  // 가족 점
  const dot = (px, py, col, mine, label) => {
    const r = big ? 7 : 3.5;
    g.fillStyle = col; g.strokeStyle = mine ? "#24352a" : "#fff"; g.lineWidth = mine ? (big ? 3 : 2) : (big ? 2 : 1.2);
    g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    if (big && label) {
      g.font = "14px Jua, sans-serif"; g.textAlign = "center";
      const tw = g.measureText(label).width + 10;
      g.fillStyle = "rgba(255,253,246,.92)"; g.beginPath(); g.roundRect(px - tw / 2, py - r - 22, tw, 18, 6); g.fill();
      g.fillStyle = col; g.fillText(label, px, py - r - 8);
    }
  };
  for (const m of markers) dot(ox + m.x * sc, oy + m.y * sc, colorOf(m.mid), false, nameOf(m.mid) + (m.inHouse ? "(집 안)" : ""));
  if (me) dot(ox + me.x * sc, oy + me.y * sc, colorOf(myMid), true, big ? "나" : "");
  g.restore();
}
