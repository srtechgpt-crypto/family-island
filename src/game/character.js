// 새 캐릭터(동글이 2등신): 캔버스 도형으로 그린다. 그림체 견본 v4와 같은 모양.
// look = {hairStyle, hairColor, topColor, bottomType, bottomColor} (색은 번호), palette = data/appearance.json
const E = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
const R = (g, x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
const SKIN = "#f8dcc4", SHOE = "#7a4a32";

function colors(look, pal) {
  return {
    hair: pal.hairColors[look.hairColor] || pal.hairColors[1],
    top: pal.clothColors[look.topColor] || pal.clothColors[6],
    bot: pal.clothColors[look.bottomColor] || pal.clothColors[10],
  };
}

function hairBack(g, hs, hc, hx, hy, hr, dir) {
  g.fillStyle = hc;
  if (hs === "long") { g.beginPath(); g.roundRect(hx - hr * 1.02, hy - hr * .2, hr * 2.04, hr * 1.75, hr * .6); g.fill(); }
  if (hs === "pony") { const sx = dir === 1 ? -1 : 1; g.beginPath(); g.ellipse(hx + sx * hr * .95, hy + hr * .35, hr * .32, hr * .7, sx * -.4, 0, 7); g.fill(); }
  if (hs === "pig") { E(g, hx - hr * 1.05, hy + hr * .45, hr * .3, hr * .5, hc); E(g, hx + hr * 1.05, hy + hr * .45, hr * .3, hr * .5, hc); }
  if (hs === "bun") E(g, hx, hy - hr * 1.05, hr * .42, hr * .36, hc);
}
function hairFront(g, hs, hc, hx, hy, hr) {
  g.fillStyle = hc;
  g.beginPath(); g.arc(hx, hy - hr * .05, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  if (hs === "short") { g.beginPath(); g.ellipse(hx - hr * .3, hy - hr * .5, hr * .6, hr * .35, -.3, 0, 7); g.fill(); }
  if (hs !== "short" && hs !== "bun") {
    g.beginPath(); g.moveTo(hx - hr, hy - hr * .1); g.quadraticCurveTo(hx - hr * .2, hy - hr * .35, hx + hr * .1, hy - hr * .75);
    g.quadraticCurveTo(hx + hr * .5, hy - hr * .3, hx + hr, hy - hr * .1); g.lineTo(hx + hr, hy - hr * .6); g.lineTo(hx - hr, hy - hr * .6); g.fill();
  }
  if (hs === "bob") { g.beginPath(); g.roundRect(hx - hr * 1.05, hy - hr * .3, hr * .35, hr * .95, hr * .2); g.fill(); g.beginPath(); g.roundRect(hx + hr * .7, hy - hr * .3, hr * .35, hr * .95, hr * .2); g.fill(); }
  if (hs === "pig") { E(g, hx - hr * .95, hy + hr * .05, hr * .1, hr * .1, "#ff7fa8"); E(g, hx + hr * .95, hy + hr * .05, hr * .1, hr * .1, "#ff7fa8"); }
}
function face(g, hx, hy, hr, dir, happy) {
  const ox = dir === 1 ? -hr * .22 : dir === 2 ? hr * .22 : 0, ey = hy + hr * .15, ex = hr * .38;
  for (const sx of [-1, 1]) {
    if (happy) { g.strokeStyle = "#2b1d16"; g.lineWidth = Math.max(1, hr * .08); g.lineCap = "round"; g.beginPath(); g.arc(hx + ox + sx * ex, ey + hr * .04, hr * .1, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else E(g, hx + ox + sx * ex, ey, hr * .09, hr * .12, "#2b1d16");
  }
  E(g, hx + ox - hr * .62, hy + hr * .42, hr * .16, hr * .1, "rgba(255,120,130,.45)");
  E(g, hx + ox + hr * .62, hy + hr * .42, hr * .16, hr * .1, "rgba(255,120,130,.45)");
  g.strokeStyle = "#7a3b2e"; g.lineWidth = Math.max(1, hr * .07); g.lineCap = "round";
  g.beginPath(); g.arc(hx + ox, hy + hr * .38, hr * .14, .2, Math.PI - .2); g.stroke();
}
function heart(g, x, y, s) {
  g.fillStyle = "#ff5c8a"; g.beginPath();
  g.moveTo(x, y + s * .35); g.bezierCurveTo(x - s, y - s * .3, x - s * .35, y - s, x, y - s * .45);
  g.bezierCurveTo(x + s * .35, y - s, x + s, y - s * .3, x, y + s * .35); g.fill();
}

// x,y = 발 위치(화면 좌표), s = 키(px), dir 0아래 1왼쪽 2오른쪽 3위, walk = 걸음 진행(초 단위 누적), emote = {kind, p(0~1)} | null
export function drawCharacter(g, look, pal, x, y, s, dir, walk, moving, emote) {
  const c = colors(look, pal), skirt = look.bottomType === "skirt", hs = look.hairStyle;
  const ek = emote && emote.kind, ep = emote ? emote.p : 0, et = ep * 3;      // et: 0~3초
  const dance = ek === "dance";
  const bob = moving ? Math.abs(Math.sin(walk * 8)) * s * .04 : dance ? Math.abs(Math.sin(et * 9)) * s * .06 : 0;
  const leg = moving ? Math.sin(walk * 8) * s * .06 : 0;
  const sway = dance ? Math.sin(et * 6) * .18 : 0;
  E(g, x, y, s * .22, s * .05, "rgba(0,0,0,.16)");
  g.save(); g.translate(x, y); g.rotate(sway); g.translate(-x, -y);
  const by = y - s * .2 - bob, hr = s * .27, hx = x, hy = by - s * .3;
  const legC = skirt ? SKIN : c.bot;
  R(g, x - s * .11, y - s * .14 + leg - bob * .5, s * .09, s * .13, s * .04, legC);
  R(g, x + s * .02, y - s * .14 - leg - bob * .5, s * .09, s * .13, s * .04, legC);
  R(g, x - s * .12, y - s * .04 + leg - bob * .5, s * .11, s * .05, s * .025, SHOE);
  R(g, x + s * .01, y - s * .04 - leg - bob * .5, s * .11, s * .05, s * .025, SHOE);
  if (dir !== 3) hairBack(g, hs, c.hair, hx, hy, hr, dir);
  // 몸
  if (skirt) {
    R(g, x - s * .13, by - s * .11, s * .26, s * .11, s * .05, c.top);
    g.fillStyle = c.bot; g.beginPath(); g.moveTo(x - s * .13, by - s * .02); g.lineTo(x + s * .13, by - s * .02);
    g.quadraticCurveTo(x + s * .24, by + s * .08, x + s * .22, by + s * .12); g.lineTo(x - s * .22, by + s * .12);
    g.quadraticCurveTo(x - s * .24, by + s * .08, x - s * .13, by - s * .02); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = Math.max(1, s * .008); g.stroke();
  } else { R(g, x - s * .15, by - s * .11, s * .3, s * .2, s * .07, c.top); R(g, x - s * .15, by + s * .04, s * .3, s * .06, s * .03, c.bot); }
  // 팔
  const swing = moving ? Math.sin(walk * 8) * .3 : 0;
  const waveA = ek === "wave" ? -2.2 + Math.sin(et * 12) * .5 : dance ? -1.6 + Math.sin(et * 9) * .8 : .25 + swing;
  const leftA = dance ? 1.6 - Math.sin(et * 9) * .8 : -.25 - swing;
  for (const [sx, a] of [[1, waveA], [-1, leftA]]) {
    g.save(); g.translate(x + sx * s * .15, by - s * .07); g.rotate(a);
    R(g, -s * .035, 0, s * .07, s * .14, s * .035, c.top); E(g, 0, s * .15, s * .04, s * .04, SKIN); g.restore();
  }
  // 머리
  E(g, hx, hy, hr, hr * .95, SKIN);
  hairFront(g, hs, c.hair, hx, hy, hr);
  if (dir === 3) { E(g, hx, hy, hr * 1.02, hr * .97, c.hair); hairBack(g, hs, c.hair, hx, hy, hr, dir); }
  else face(g, hx, hy, hr, dir, !!ek);
  g.restore();
  if (ek === "heart") { const rise = ep * s * .35; g.globalAlpha = 1 - Math.max(0, ep - .7) / .3; heart(g, x + s * .25, hy - hr - s * .05 - rise, s * .14); heart(g, x - s * .2, hy - hr - s * .18 - rise * 1.2, s * .1); g.globalAlpha = 1; }
  if (ek === "yum") {   // 냠냠(v3): 말풍선
    const bx = x + s * .32, by = hy - hr - s * .12, bob = Math.sin(et * 10) * s * .015;
    g.globalAlpha = 1 - Math.max(0, ep - .8) / .2;
    g.fillStyle = "#fffdf6"; g.strokeStyle = "rgba(60,40,20,.35)"; g.lineWidth = Math.max(1, s * .012);
    g.beginPath(); g.roundRect(bx - s * .2, by - s * .1 + bob, s * .4, s * .17, s * .06); g.fill(); g.stroke();
    g.fillStyle = "#e0624f"; g.font = `${Math.round(s * .1)}px Jua, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("냠냠", bx, by - s * .015 + bob); g.textBaseline = "alphabetic"; g.globalAlpha = 1;
  }
  return { headTop: hy - hr - (hs === "bun" ? hr * .4 : 0) };
}
