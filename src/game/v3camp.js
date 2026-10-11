// v3 캠프파이어: 광장 불(저녁 7~10시), 모인 가족 수만큼 큰 불, 마시멜로 굽기, 노래 함께, 3명 이상이면 불꽃놀이
import { CampFx } from "./campArt.js";
import { isCampOpen, fireScale, familyAtFire, roastResult, ROAST_MS, kstDay, FIREWORKS_MIN } from "../domain/campfire.js";
import { songDurationMs } from "../domain/songTiming.js";
import { serverNow } from "../services/fb.js";
import * as CS from "../services/campfireStore.js";
import * as W from "../services/worldStore.js";
import * as P from "../services/playerStore.js";
import * as SP from "../audio/songPlayer.js";
import { state, onState } from "../state.js";
import { FAMILY } from "../config/gameConfig.js";

export class CampLayer {
  constructor(game) {
    this.game = game;
    this.c = game.data.campfire;
    this.song = game.data.songs.songs.camp1;
    this.songLen = songDurationMs(this.song);
    this.fx = new CampFx();
    this.roast = null;          // { t0 }
    this.attended = null;       // 오늘 참석 기록한 날
    // 불 자리는 걸을 수 없게
    const w = game.world; for (let dx = -1; dx <= 1; dx++) w.solidStatic[this.c.y * w.w + this.c.x + dx] = 1; w.setHouses(w.houses);
    CS.watchCampToday();
    // 껐다 켰을 때: 개인 기록엔 있는데 가족 추억에 못 들어간 마시멜로 다시 쓰기(입장 때 바로 + 실패하면 다음 갱신 때)
    const recover = () => { if (this.recovered || !state.player) return; this.recovered = true; CS.recoverRoasts(state.player).catch(() => { this.recovered = false; }); };
    recover(); onState(x => { if (x === "player") recover(); });
  }

  now() { return serverNow(); }
  open() { return isCampOpen(this.now()); }
  lit() { return this.open() && !!(state.camp && state.camp.ignition); }
  near(x, y, r = this.c.radius) { return Math.hypot(x - (this.c.x + 0.5), y - (this.c.y + 0.5)) <= r; }
  meNear() { return this.game.mode === "island" && this.near(this.game.me.x, this.game.me.y); }
  atFire() { return familyAtFire(W.allPresence().island || {}, state.members, { x: this.c.x + 0.5, y: this.c.y + 0.5 }, this.c.radius, this.now()); }
  songOn() { const s = state.camp && state.camp.song; if (!s) return null; const t = this.now() - s.startAt; return t > -2500 && t < this.songLen + 500 ? s : null; }
  roastsLeft() { const d = kstDay(this.now()); const n = (state.player && state.player.camp && state.player.camp[d] && state.player.camp[d].n) || 0; return Math.max(0, 3 - n); }

  // 매 프레임: 날 바뀜·참석·노래·불꽃놀이
  tick() {
    CS.watchCampToday();
    const near = this.meNear(), lit = this.lit();
    if (near && lit && this.attended !== CS.campDay() && !this.attending) {
      const d = CS.campDay(); this.attending = true;
      CS.markAttendance().then(ok => { if (ok) this.attended = d; }).finally(() => { setTimeout(() => { this.attending = false; }, 5000); });
    }
    const s = this.songOn();
    if (s && near && lit) SP.playSong(s.id, this.song, s.startAt, this.now());
    else if (SP.songPlayingId() && (!s || !near)) SP.stopSong();
    if (lit && near) {
      const fam = this.atFire();
      if (fam.length >= FIREWORKS_MIN && !(state.camp && state.camp.fireworks)) CS.fireworks();
    }
    const f = state.camp && state.camp.fireworks;
    if (f && near && this.now() - (f.at || 0) < 60000) this.fx.fireworks(f.id, 0, 0, this.game.W, this.game.H, FAMILY.map(m => m.color));
    if (this.roast && performance.now() - this.roast.t0 >= ROAST_MS) this.pull();
    if (this.roast && (!near || !lit)) { this.roast = null; this.game.ui.toast("불에서 멀어져서 마시멜로를 내려놨어요"); }
  }
  heartbeatMs() { return this.meNear() ? 10000 : 60000; }

  // 섬 그림: 빛(아래) + 불(사람과 함께 정렬)
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1, dt, t) {
    const { x, y } = this.c;
    if (x < x0 - 3 || x > x1 + 3 || y < y0 - 3 || y > y1 + 3) return;
    const cx = (x + 0.5) * TS - camX, cy = (y + 0.6) * TS - camY, lit = this.lit();
    const scale = fireScale(Math.max(1, this.atFire().length));
    if (lit) this.fx.drawGlow(g, cx, cy, TS, scale, true);
    list.push({ y: y + 0.7, f: () => {
      this.fx.drawFire(g, cx, cy, TS, lit, scale, t, dt);
      if (this.roast) this.fx.drawStick(g, cx, cy, TS, Math.min(1, (performance.now() - this.roast.t0) / ROAST_MS));
    } });
  }
  // 화면 위 표시: 마시멜로 막대, 불꽃놀이
  drawOverlay(g, dt) {
    this.fx.drawFireworks(g, dt);
    if (!this.roast) return;
    const p = Math.min(1, (performance.now() - this.roast.t0) / ROAST_MS), W = Math.min(320, this.game.W * 0.5), x = (this.game.W - W) / 2, y = 18;
    const raw = 3300 / ROAST_MS, gold = 4800 / ROAST_MS;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.roundRect(x - 8, y - 8, W + 16, 46, 12); g.fill();
    g.fillStyle = "#fff6e6"; g.fillRect(x, y, W * raw, 16); g.fillStyle = "#5fbf5a"; g.fillRect(x + W * raw, y, W * (gold - raw), 16); g.fillStyle = "#5b3b2b"; g.fillRect(x + W * gold, y, W * (1 - gold), 16);
    g.fillStyle = "#fff"; g.fillRect(x + W * p - 2, y - 5, 4, 26);
    g.font = "13px Jua, sans-serif"; g.textAlign = "center"; g.fillStyle = "#fff";
    g.fillText("덜 익음", x + W * raw / 2, y + 32); g.fillText("노릇노릇", x + W * (raw + gold) / 2, y + 32); g.fillText("탐", x + W * (1 + gold) / 2, y + 32);
  }
  // 노래 중 불 옆 가족은 흔들흔들
  swayOf(mid, x, y) {
    if (!this.songOn() || !this.near(x, y)) return 0;
    const i = FAMILY.findIndex(f => f.mid === mid);
    return Math.sin(performance.now() / 260 + i) * 0.16;
  }

  // ---- 행동 ----
  async ignite() {
    if (!this.open()) return "매일 저녁 7시~10시에 불을 피울 수 있어요";
    if (this.lit()) return "벌써 불이 붙어 있어요";
    if (!((state.player.inv.branch || 0) > 0)) return "나뭇가지가 1개 필요해요. 나무를 흔들어 봐요";
    const r = await CS.ignite();
    if (!r.ok) return "불을 붙이지 못했어요. 연결을 확인해 주세요";
    if (!r.mine) return "가족이 먼저 불을 붙였어요!";
    await P.payIgnition(CS.campDay()).catch(() => {});
    return "🔥 불이 활활 타올라요!";
  }
  startRoast() {
    if (!this.lit()) return "불이 붙어 있을 때 구울 수 있어요";
    if (this.roastsLeft() <= 0) return "오늘 마시멜로는 다 구웠어요. 내일 또 만나요";
    this.roast = { t0: performance.now() };
    return null;
  }
  async pull() {
    if (!this.roast) return;
    const res = roastResult(performance.now() - this.roast.t0);
    this.roast = null;
    const day = kstDay(this.now());
    const r = await P.saveRoast(day, res).catch(() => ({ ok: false }));
    const msg = { raw: "덜 익은 마시멜로… 말랑말랑해요", golden: "노릇노릇 완벽해요! 🍡✨", burnt: "앗, 새까맣게 탔어요 😅" }[res];
    if (!r.ok) { this.game.ui.toast(r.reason || "저장하지 못했어요"); return; }
    this.game.ui.toast(msg + "\n가방에 넣었어요");
    const n = r.n;
    CS.logRoast(day, n, res).catch(() => {});
  }
  async sing() {
    if (!this.lit()) return "불이 붙어 있을 때 노래할 수 있어요";
    SP.unlock();
    if (this.songOn()) return "지금 노래하는 중이에요. 같이 들어요 🎵";
    const r = await CS.startSong("camp1", this.songLen);
    return r.ok ? "🎵 모두 함께 노래해요!" : "노래를 시작하지 못했어요";
  }
}
