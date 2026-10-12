// v3 집: 공유 위치(housing) 반영, 겉모습 그림, 집 옮기기(걸어가서 그 자리에 놓기)
import { houseCanvas, HOUSE_PAD } from "./houseArt.js";
import { resolveHouses, buildPlacementStatic, validateHousePlacement, PLACE_REASON_TEXT } from "../domain/housing.js";
import { exteriorOf } from "../domain/houseAppearance.js";
import { state, onState } from "../state.js";
import { nameOf } from "../config/gameConfig.js";
import * as H from "../services/houseStore.js";

export class HouseLayer {
  constructor(game) {
    this.game = game;
    const d = game.data;
    this.def = d.houseAppearance;
    // v4: 밭·호수·나루터·목장도 집을 놓을 수 없는 자리
    this.stat = buildPlacementStatic(game.world.map, { forage: d.forage, insects: d.insects, campfire: d.campfire, fields: d.gatheringFields.fields, lake: d.lake, docks: game.world.map.docks, ranch: game.world.map.ranch });
    this.move = null;      // { pos, key, res }
    this.sync();
    onState(w => { if (w === "housing" || w === "members") this.sync(); });
  }

  // 공유 위치 → 지도·충돌 갱신. 내 캐릭터가 새 집 속에 갇히면 그 집 문 앞으로
  sync() {
    const g = this.game, w = g.world;
    // 6채를 한 번에 확정(m0부터). 저장 자리가 v4 지도에서 무효면 기본 자리로 '읽기만' 함(저장값은 그대로)
    const all = resolveHouses(this.stat, w.mapHouses, state.housing || {});
    const houses = all.filter(h => h.source !== null);
    const mine = all.find(h => h.mid === state.mid);
    if (mine && mine.source !== "saved" && mine.reasons.length && !this.warned) { this.warned = true; setTimeout(() => g.ui.toast("섬이 바뀌어서 집을 원래 자리에 두었어요.\n'집 옮기기'로 다시 고를 수 있어요", 5000), 2500); }
    w.setHouses(houses);
    if (g.mode === "island" && !w.walkable(g.me.x, g.me.y)) {
      const h = houses.find(h => g.me.x >= h.x && g.me.x < h.x + h.w && g.me.y >= h.y && g.me.y < h.y + h.h);
      if (h) { g.me.x = h.door.x + 0.5; g.me.y = h.door.y + 1.5; }
    }
    if (this.move) this.move.key = null;   // 다시 판정
  }
  extOf(mid) { const raw = state.housing && state.housing.houses && state.housing.houses[mid]; return exteriorOf(raw && raw.ext, mid, this.def); }

  // 섬 그리기 목록에 집 넣기
  addHouses(list, g, TS, camX, camY, x0, y0, x1, y1) {
    for (const h of this.game.world.houses) {
      if (h.x + h.w + 1 < x0 || h.x - 1 > x1 || h.y + h.h + 1 < y0 || h.y - 1 > y1) continue;
      if (this.move && h.mid === state.mid) continue;   // 옮기는 중엔 미리보기만
      list.push({ y: h.y + h.h, f: () => this.drawAt(g, h.mid, h.x, h.y, TS, camX, camY, 1) });
    }
    if (this.move) {
      const p = this.move.pos, ok = this.move.res && this.move.res.ok;
      list.push({ y: p.y + 5, f: () => {
        this.drawAt(g, state.mid, p.x, p.y, TS, camX, camY, 0.6);
        g.lineWidth = 4; g.strokeStyle = ok ? "#3fbf4a" : "#e5452e"; g.setLineDash([10, 6]);
        g.strokeRect(p.x * TS - camX, p.y * TS - camY, 6 * TS, 5 * TS); g.setLineDash([]);
      } });
    }
  }
  drawAt(g, mid, x, y, TS, camX, camY, alpha) {
    const c = houseCanvas(this.extOf(mid), this.def, nameOf(mid));
    g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true;
    g.drawImage(c, (x - HOUSE_PAD.l) * TS - camX, (y - HOUSE_PAD.t) * TS - camY, (6 + HOUSE_PAD.l + HOUSE_PAD.r) * TS, (5 + HOUSE_PAD.t + HOUSE_PAD.b) * TS);
    g.restore();
  }

  // ---- 집 옮기기 ----
  // 가족 모두(자리에 기기가 연결된 사람) 새 버전으로 한 번 들어와야 열림
  canStartMove() {
    const old = Object.entries(state.members || {}).filter(([, m]) => m && m.uid && !(m.app >= 3)).map(([mid]) => nameOf(mid));
    return old.length ? { ok: false, who: old } : { ok: true };
  }
  startMove() { this.move = { pos: this.posHere(), key: null, res: null }; this.update(); }
  stopMove() { this.move = null; }
  // 내가 선 칸이 문 앞(문 아래 칸)이 되도록
  posHere() { const m = this.game.me; return { x: Math.floor(m.x) - 2, y: Math.floor(m.y) - 5 }; }
  update() {
    if (!this.move) return;
    const p = this.posHere(), key = p.x + "," + p.y;
    this.move.pos = p;
    if (key === this.move.key) return;
    this.move.key = key;
    this.move.res = validateHousePlacement(this.stat, this.game.world.houses, state.mid, p);
  }
  reasonText() {
    const r = this.move && this.move.res;
    if (!r || r.ok) return "";
    return (r.reasons || []).slice(0, 2).map(c => PLACE_REASON_TEXT[c] || c).join(" · ");
  }
  async confirm() {
    const m = this.move; if (!m || !m.res || !m.res.ok) return { ok: false, reason: this.reasonText() || "여기엔 지을 수 없어요" };
    const pos = { ...m.pos };
    const r = await H.moveHouse(pos, latest => {
      const houses = resolveHouses(this.stat, this.game.world.mapHouses, latest).filter(h => h.source !== null);
      const v = validateHousePlacement(this.stat, houses, state.mid, pos);
      return v.ok ? { ok: true } : { ok: false, reason: (v.reasons || []).map(c => PLACE_REASON_TEXT[c] || c)[0] || "다른 가족이 먼저 이 근처를 골랐어요" };
    }).catch(() => ({ ok: false, reason: "저장하지 못했어요" }));
    if (r.ok) this.move = null;
    else if (r.reason === "busy") r.reason = "다른 가족이 막 집을 옮겼어요. 다시 눌러 주세요";
    return r;
  }
}
