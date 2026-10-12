// 새 캐릭터(동글이 2등신): 캔버스 도형으로 그린다. 그림체 견본 v4와 같은 모양.
// look = {hairStyle, hairColor, topColor, bottomType, bottomColor} (색은 번호), palette = data/appearance.json
// 감정 표현(v5, 22가지 + 냠냠): 얼굴 표정 · 머리 위 그림 · 몸 자세를 나눠 조합한다.
const E = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
const R = (g, x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
const SKIN = "#f8dcc4", SHOE = "#7a4a32", INK = "#2b1d16", MOUTH = "#7a3b2e";
const DUR = { dance: 5, robot: 5, ballet: 5, bunny: 5, freestyle: 5, sit: 30 };   // 초(나머지 3초) — domain/emotes.js와 같은 값

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

// 얼굴 표정: mode = normal | happy | laugh | surprise | sad | angry | sleepy | curious | robot
function face(g, hx, hy, hr, dir, mode, t) {
  const ox = dir === 1 ? -hr * .22 : dir === 2 ? hr * .22 : 0, ey = hy + hr * .15, ex = hr * .38, lw = Math.max(1, hr * .08);
  const line = (w, c = INK) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; };
  for (const sx of [-1, 1]) {
    const cx = hx + ox + sx * ex;
    if (mode === "happy" || mode === "laugh") { line(lw); g.beginPath(); g.arc(cx, ey + hr * .04, hr * .1, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else if (mode === "surprise") { E(g, cx, ey, hr * .12, hr * .15, INK); E(g, cx - hr * .03, ey - hr * .05, hr * .04, hr * .04, "#fff"); }
    else if (mode === "sleepy") { line(lw); g.beginPath(); g.moveTo(cx - hr * .1, ey + hr * .02); g.lineTo(cx + hr * .1, ey + hr * .02); g.stroke(); }
    else if (mode === "robot") { E(g, cx, ey, hr * .11, hr * .11, INK); E(g, cx, ey, hr * .05, hr * .05, "#7fe0ff"); }
    else if (mode === "sad") { E(g, cx, ey + hr * .03, hr * .09, hr * .11, INK); }
    else E(g, cx, ey, hr * .09, hr * .12, INK);
    // 눈썹
    if (mode === "sad") { line(lw * .8); g.beginPath(); g.moveTo(cx - sx * hr * .12, ey - hr * .2); g.lineTo(cx + sx * hr * .1, ey - hr * .3); g.stroke(); }
    if (mode === "angry") { line(lw); g.beginPath(); g.moveTo(cx - sx * hr * .14, ey - hr * .3); g.lineTo(cx + sx * hr * .1, ey - hr * .2); g.stroke(); }
    if (mode === "curious" && sx === 1) { line(lw * .8); g.beginPath(); g.arc(cx, ey - hr * .2, hr * .12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  }
  if (mode !== "angry") {
    E(g, hx + ox - hr * .62, hy + hr * .42, hr * .16, hr * .1, mode === "laugh" ? "rgba(255,110,120,.6)" : "rgba(255,120,130,.45)");
    E(g, hx + ox + hr * .62, hy + hr * .42, hr * .16, hr * .1, mode === "laugh" ? "rgba(255,110,120,.6)" : "rgba(255,120,130,.45)");
  }
  const mx = hx + ox, my = hy + hr * .38;
  line(Math.max(1, hr * .07), MOUTH);
  if (mode === "laugh") { g.fillStyle = "#b8463a"; g.beginPath(); g.arc(mx, my - hr * .02, hr * .17, 0, Math.PI); g.closePath(); g.fill(); E(g, mx, my + hr * .1, hr * .07, hr * .04, "#ff9aa8"); }
  else if (mode === "surprise") { g.fillStyle = "#b8463a"; g.beginPath(); g.ellipse(mx, my + hr * .04, hr * .08, hr * .11, 0, 0, 7); g.fill(); }
  else if (mode === "sad" || mode === "angry") { g.beginPath(); g.arc(mx, my + hr * .16, hr * .14, Math.PI + .3, -.3); g.stroke(); }
  else if (mode === "sleepy") { g.fillStyle = "#b8463a"; g.beginPath(); g.ellipse(mx, my + hr * .04, hr * .06, hr * (.05 + .04 * Math.abs(Math.sin(t * 2))), 0, 0, 7); g.fill(); }
  else if (mode === "robot") { g.beginPath(); g.moveTo(mx - hr * .14, my + hr * .05); g.lineTo(mx + hr * .14, my + hr * .05); g.stroke(); }
  else if (mode === "curious") { g.beginPath(); g.arc(mx + hr * .05, my + hr * .05, hr * .07, 0, Math.PI * 2); g.stroke(); }
  else { g.beginPath(); g.arc(mx, my, hr * .14, .2, Math.PI - .2); g.stroke(); }
  // 슬픔: 눈물 줄기
  if (mode === "sad") { const ty = ((t * 1.2) % 1) * hr * .5; E(g, hx + ox - ex, ey + hr * .2 + ty, hr * .06, hr * .09, "#7cc4ff"); E(g, hx + ox + ex, ey + hr * .25 + ty * .8, hr * .05, hr * .08, "#7cc4ff"); }
}

function heart(g, x, y, s, c = "#ff5c8a") {
  g.fillStyle = c; g.beginPath();
  g.moveTo(x, y + s * .35); g.bezierCurveTo(x - s, y - s * .3, x - s * .35, y - s, x, y - s * .45);
  g.bezierCurveTo(x + s * .35, y - s, x + s, y - s * .3, x, y + s * .35); g.fill();
}
function sparkle(g, x, y, r, c = "#ffd35c") {
  g.fillStyle = c; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function bubbleText(g, x, y, s, text, color, t) {
  const bob = Math.sin(t * 10) * s * .015;
  g.font = `${Math.round(s * .1)}px Jua, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const w = Math.max(s * .3, g.measureText(text).width + s * .1);
  g.fillStyle = "#fffdf6"; g.strokeStyle = "rgba(60,40,20,.35)"; g.lineWidth = Math.max(1, s * .012);
  g.beginPath(); g.roundRect(x - w / 2, y - s * .1 + bob, w, s * .17, s * .06); g.fill(); g.stroke();
  g.fillStyle = color; g.fillText(text, x, y - s * .015 + bob); g.textBaseline = "alphabetic";
}

// 머리 위 그림
function overhead(g, kind, x, top, s, p, t) {
  const fade = 1 - Math.max(0, p - .8) / .2;
  g.save(); g.globalAlpha = Math.max(0, fade);
  const ax = x + s * .26, ay = top - s * .1;
  switch (kind) {
    case "heart": { const rise = p * s * .35; heart(g, x + s * .25, top - s * .05 - rise, s * .14); heart(g, x - s * .2, top - s * .18 - rise * 1.2, s * .1); break; }
    case "laugh": bubbleText(g, ax + s * .05, ay, s, "하하", "#e0624f", t); break;
    case "surprise": {
      const k = Math.min(1, t * 6), h = s * .2 * k;
      g.fillStyle = "#ffcf33"; g.strokeStyle = "#a8741a"; g.lineWidth = Math.max(1, s * .012);
      g.beginPath(); g.roundRect(ax - s * .03, ay - h, s * .06, h * .7, s * .03); g.fill(); g.stroke();
      g.beginPath(); g.arc(ax, ay - h * .1, s * .03, 0, 7); g.fill(); g.stroke(); break;
    }
    case "sad": for (let i = 0; i < 2; i++) { const yy = ((t * .8 + i * .5) % 1) * s * .2; E(g, ax - i * s * .08, ay - s * .12 + yy, s * .025, s * .04, "#7cc4ff"); } break;
    case "angry": {
      g.strokeStyle = "#e3463b"; g.lineWidth = Math.max(2, s * .025); g.lineCap = "round";
      const pulse = 1 + Math.sin(t * 12) * .12, r = s * .06 * pulse;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(ax + Math.cos(a) * r * 1.4, ay - s * .05 + Math.sin(a) * r * 1.4, r * .8, a + Math.PI * .65, a + Math.PI * 1.35); g.stroke(); }
      break;
    }
    case "sleepy": {
      g.fillStyle = "#6f7fd8"; g.textAlign = "center";
      for (let i = 0; i < 3; i++) { const k = (t * .7 + i / 3) % 1; g.globalAlpha = Math.max(0, fade * (1 - k)); g.font = `${Math.round(s * (.08 + i * .03))}px Jua, sans-serif`; g.fillText("Z", ax + k * s * .12, ay - k * s * .25); }
      break;
    }
    case "curious": { g.font = `${Math.round(s * .22)}px Jua, sans-serif`; g.textAlign = "center"; g.lineWidth = Math.max(2, s * .02); g.strokeStyle = "#fffdf6"; g.strokeText("?", ax, ay + Math.sin(t * 4) * s * .02); g.fillStyle = "#5aa0d0"; g.fillText("?", ax, ay + Math.sin(t * 4) * s * .02); break; }
    case "idea": {
      const bx = x, by = top - s * .17;
      g.strokeStyle = "#ffd35c"; g.lineWidth = Math.max(1.5, s * .015); g.lineCap = "round";
      for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6, r0 = s * .1, r1 = s * (.14 + .02 * Math.sin(t * 8 + i)); g.beginPath(); g.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0); g.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1); g.stroke(); }
      E(g, bx, by, s * .065, s * .07, "#fff3a0"); g.strokeStyle = "#d6a92a"; g.lineWidth = Math.max(1, s * .01); g.beginPath(); g.ellipse(bx, by, s * .065, s * .07, 0, 0, 7); g.stroke();
      R(g, bx - s * .03, by + s * .06, s * .06, s * .035, s * .01, "#9aa0a8"); break;
    }
    case "thanks": { heart(g, ax, ay - p * s * .1, s * .09, "#ff8fb1"); sparkle(g, ax - s * .14, ay - s * .06, s * .035 * (1 + Math.sin(t * 9) * .3)); sparkle(g, ax + s * .1, ay - s * .14, s * .028); break; }
    case "yum": bubbleText(g, x + s * .32, top - s * .12, s, "냠냠", "#e0624f", t); break;
  }
  g.restore();
}

const FACE = { heart: "happy", laugh: "laugh", surprise: "surprise", sad: "sad", angry: "angry", sleepy: "sleepy", curious: "curious", idea: "happy", thanks: "happy",
  wave: "happy", clap: "happy", bow: "happy", jump: "laugh", spin: "happy", sit: "happy", thumbs_up: "happy", peace: "happy",
  dance: "laugh", robot: "robot", ballet: "happy", bunny: "laugh", freestyle: "laugh", yum: "happy" };

// 몸 자세: 팔 각도(오른팔 armR은 음수일수록 위로, 왼팔 armL은 양수일수록 위로), 들림·기울기·방향 등
function pose(ek, t, s, moving, walk, ex = {}) {
  const swing = moving ? Math.sin(walk * 8) * .3 : 0;
  const P = { armR: .25 + swing, armL: -.25 - swing, bob: moving ? Math.abs(Math.sin(walk * 8)) * s * .04 : 0, lift: 0, sway: 0, leg: moving ? Math.sin(walk * 8) * s * .06 : 0,
    dir: null, sit: false, headDrop: 0, hand: null, jitter: 0, legUp: 0 };
  const S = Math.sin;
  switch (ek) {
    case "wave": P.armR = -2.2 + S(t * 12) * .5; break;
    case "surprise": P.armR = -.9; P.armL = .9; P.lift = t < .25 ? S(t / .25 * Math.PI) * s * .05 : 0; break;
    case "sad": P.armR = .1; P.armL = -.1; P.headDrop = s * .02; break;
    case "angry": P.armR = .9; P.armL = -.9; P.jitter = S(t * 40) * s * .008; break;
    case "sleepy": P.sway = S(t * 1.6) * .06; P.headDrop = (S(t * 1.6) + 1) * s * .01; break;
    case "curious": P.sway = .12; P.armR = -2.6; break;
    case "idea": P.armR = -2.8; break;
    case "thanks": P.armR = .85; P.armL = -.85; P.headDrop = Math.max(0, S(Math.min(1, t / 1.2) * Math.PI)) * s * .05; break;
    case "clap": { const c = .75 + S(t * 14) * .3; P.armR = c; P.armL = -c; if (S(t * 14) > .9) P.hand = "clap"; break; }
    case "bow": { const k = Math.max(0, S(Math.min(1, t / 1.6) * Math.PI)); P.headDrop = k * s * .1; P.armR = .5; P.armL = -.5; P.bob = -k * s * .02; break; }
    case "jump": { const c = t % 1.2; if (c < .25) { P.bob = -S(c / .25 * Math.PI) * s * .04; } else if (c < .85) { P.lift = S((c - .25) / .6 * Math.PI) * s * .3; P.armR = -2.3; P.armL = 2.3; } break; }
    case "spin": { const seq = [0, 2, 3, 1]; P.dir = t < 2.4 ? seq[Math.floor(t / .2) % 4] : 0; P.armR = -.9; P.armL = .9; break; }
    case "sit": P.sit = true; P.armR = .55; P.armL = -.55; P.leg = 0; P.bob = 0; break;
    case "thumbs_up": P.armR = -2.0; P.hand = "thumb"; break;
    case "peace": P.armR = -2.75; P.hand = "peace"; P.sway = -.06; break;
    case "dance": P.bob = Math.abs(S(t * 9)) * s * .06; P.sway = S(t * 6) * .18; P.armR = -1.6 + S(t * 9) * .8; P.armL = 1.6 - S(t * 9) * .8; break;
    case "robot": { const k = Math.floor(t / .35) % 4, A = [[-1.57, 0], [0, 1.57], [-1.57, 1.57], [0, 0]][k]; P.armR = A[0]; P.armL = A[1]; P.bob = (k % 2) * s * .02; P.dir = [0, 2, 0, 1][Math.floor(t / 1.4) % 4]; break; }
    case "ballet": P.armR = -2.75; P.armL = 2.75; P.dir = [0, 2, 3, 1][Math.floor(t / .6) % 4]; P.legUp = (S(t * 2.2) + 1) / 2 * s * .06; P.sway = S(t * 1.5) * .05; P.lift = s * .02; break;
    case "bunny": { const c = t % .55; P.armR = .9; P.armL = -.9; P.lift = S(c / .55 * Math.PI) * s * .12; P.hand = "ears"; break; }
    case "fishing": {   // 낚시(내 화면): 두 손으로 대를 물 쪽으로, 물면 확 당김
      const b = ex.bite ? 1 : 0, wob = S(t * 2.5) * .05;
      if (ex.dir === 2) { P.armR = -1.25 - b * .8 + wob; P.armL = -.55 - b * .5; }
      else if (ex.dir === 1) { P.armR = .55 + b * .5; P.armL = 1.25 + b * .8 - wob; }
      else { P.armR = .75 - b * 2.3 + wob; P.armL = -.75 + b * 2.3 - wob; }
      if (b) { P.lift = Math.abs(S(t * 18)) * s * .03; P.sway = (ex.dir === 1 ? .12 : ex.dir === 2 ? -.12 : 0); }
      break;
    }
    case "freestyle": P.armR = -1.2 + S(t * 7) * 1.4; P.armL = 1.2 + S(t * 5.3 + 1) * 1.4; P.sway = S(t * 4.5) * .25; P.bob = Math.abs(S(t * 7)) * s * .07; P.leg = S(t * 9) * s * .05; break;
  }
  return P;
}

// x,y = 발 위치(화면 좌표), s = 키(px), dir 0아래 1왼쪽 2오른쪽 3위, walk = 걸음 진행(초 단위 누적)
// emote = {kind, p(0~1), t?(초)} | null — t가 없으면 p × 길이로 계산
export function drawCharacter(g, look, pal, x, y, s, dir, walk, moving, emote) {
  const c = colors(look, pal), skirt = look.bottomType === "skirt", hs = look.hairStyle;
  const ek = emote && emote.kind, ep = emote ? emote.p : 0, et = emote ? (Number.isFinite(emote.t) ? emote.t : ep * (DUR[ek] || 3)) : 0;
  const P = pose(ek, et, s, moving, walk, emote || {});
  if (P.dir !== null) dir = P.dir;
  const faceMode = ek === "fishing" ? (emote.bite ? "surprise" : "normal") : ek ? FACE[ek] || "happy" : "normal";
  E(g, x, y, s * .22 * (1 - Math.min(.4, P.lift / s)), s * .05, "rgba(0,0,0,.16)");   // 그림자(뛰면 작아짐)
  g.save(); g.translate(P.jitter, -P.lift); g.translate(x, y); g.rotate(P.sway); g.translate(-x, -y);
  const sitDrop = P.sit ? s * .1 : 0;
  const by = y - s * .2 - P.bob + sitDrop, hr = s * .27, hx = x, hy = by - s * .3 + P.headDrop;
  const legC = skirt ? SKIN : c.bot, leg = P.leg;
  if (P.sit) {
    // 바닥에 앉은 다리: 앞으로 뻗은 짧은 다리 + 신발 바닥
    R(g, x - s * .13, y - s * .07, s * .11, s * .08, s * .04, legC); R(g, x + s * .02, y - s * .07, s * .11, s * .08, s * .04, legC);
    E(g, x - s * .09, y - s * .005, s * .06, s * .035, SHOE); E(g, x + s * .09, y - s * .005, s * .06, s * .035, SHOE);
  } else {
    R(g, x - s * .11, y - s * .14 + leg - P.bob * .5 - P.legUp, s * .09, s * .13, s * .04, legC);
    R(g, x + s * .02, y - s * .14 - leg - P.bob * .5, s * .09, s * .13, s * .04, legC);
    R(g, x - s * .12, y - s * .04 + leg - P.bob * .5 - P.legUp, s * .11, s * .05, s * .025, SHOE);
    R(g, x + s * .01, y - s * .04 - leg - P.bob * .5, s * .11, s * .05, s * .025, SHOE);
  }
  if (dir !== 3) hairBack(g, hs, c.hair, hx, hy, hr, dir);
  // 몸
  if (skirt) {
    R(g, x - s * .13, by - s * .11, s * .26, s * .11, s * .05, c.top);
    g.fillStyle = c.bot; g.beginPath(); g.moveTo(x - s * .13, by - s * .02); g.lineTo(x + s * .13, by - s * .02);
    g.quadraticCurveTo(x + s * .24, by + s * .08, x + s * .22, by + s * .12); g.lineTo(x - s * .22, by + s * .12);
    g.quadraticCurveTo(x - s * .24, by + s * .08, x - s * .13, by - s * .02); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = Math.max(1, s * .008); g.stroke();
  } else { R(g, x - s * .15, by - s * .11, s * .3, s * .2, s * .07, c.top); R(g, x - s * .15, by + s * .04, s * .3, s * .06, s * .03, c.bot); }
  // 팔(+ 손 모양): 내린 팔은 머리 뒤(먼저), 든 팔은 머리 앞(나중)에 — 큰 머리에 가려지지 않게 어깨를 바깥으로
  const arm = (sx, a) => {
    const up = Math.abs(a) > 1.0, px = x + sx * s * (up ? .2 : .15), py = by - s * (up ? .1 : .07), L = up ? .17 : .14;
    g.save(); g.translate(px, py); g.rotate(a);
    R(g, -s * .035, 0, s * .07, s * L, s * .035, c.top); E(g, 0, s * (L + .01), s * .042, s * .042, SKIN);
    if (sx === 1 && P.hand === "thumb") { g.save(); g.translate(0, s * (L + .01)); g.rotate(-a); R(g, -s * .013, -s * .09, s * .026, s * .062, s * .013, SKIN); g.restore(); }
    if (sx === 1 && P.hand === "peace") { g.save(); g.translate(0, s * (L + .01)); g.rotate(-a); for (const r of [-.3, .3]) { g.save(); g.rotate(r); R(g, -s * .012, -s * .095, s * .024, s * .068, s * .012, SKIN); g.restore(); } g.restore(); }
    g.restore();
  };
  const arms = [[1, P.armR], [-1, P.armL]];
  for (const [sx, a] of arms) if (Math.abs(a) <= 1.0) arm(sx, a);
  if (P.hand === "clap") { sparkle(g, x, by - s * .02, s * .05, "#fff3a0"); }
  // 머리
  E(g, hx, hy, hr, hr * .95, SKIN);
  hairFront(g, hs, c.hair, hx, hy, hr);
  if (dir === 3) { E(g, hx, hy, hr * 1.02, hr * .97, c.hair); hairBack(g, hs, c.hair, hx, hy, hr, dir); }
  else face(g, hx, hy, hr, dir, faceMode, et);
  if (ek === "angry" && dir !== 3) { E(g, hx, hy + hr * .1, hr * .95, hr * .85, "rgba(255,80,60,.12)"); }
  if (P.hand === "ears") for (const sx of [-1, 1]) {                       // 토끼 귀(머리 위)
    g.save(); g.translate(hx + sx * hr * .45, hy - hr * .8); g.rotate(sx * (.2 + Math.sin(et * 10) * .1));
    E(g, 0, -hr * .45, hr * .2, hr * .55, "#fff"); E(g, 0, -hr * .45, hr * .1, hr * .38, "#ffb3c6"); g.restore();
  }
  for (const [sx, a] of arms) if (Math.abs(a) > 1.0) arm(sx, a);
  g.restore();
  const top = hy - hr - P.lift;
  if (ek && ek !== "fishing") overhead(g, ek, x, top, s, ep, et);
  return { headTop: top - (hs === "bun" ? hr * .4 : 0) };
}
