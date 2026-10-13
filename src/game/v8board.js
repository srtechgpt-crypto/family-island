// 버전 8 오늘의 부탁 게시판(캠프 광장 옆, 지도 고정 1칸): 행동 버튼·그리기, 받은 물건 알림
import { state } from "../state.js";
import { nameOf, josa } from "../config/gameConfig.js";
import * as RQ from "../services/requestStore.js";
import { drawBoard } from "./ranchArt.js";

export class BoardLayer {
  constructor(game) {
    this.game = game;
    const b = this.cfg = game.data.board, w = game.world;
    w.solidStatic[b.y * w.w + b.x] = 1;      // 게시판 칸은 못 지나감
    w.setHouses(w.houses);
    RQ.startRequests(b, game.data.items);
    RQ.onRequests(e => {
      if (!e || !e.got) return;
      const it = game.data.items[e.got.item] || { icon: "🎁", name: e.got.item };
      game.ui.toast(`💌 ${josa(nameOf(e.got.from), "이", "가")} ${it.icon} ${it.name} ×${e.got.qty}를 갖다줬어요!\n가방에 들어왔어요`, 3200);
      if (game.ui.boardOpen && game.ui.boardOpen()) game.ui.openBoard();
    });
  }
  near(r = 1.6) { const m = this.game.me, b = this.cfg; return this.game.mode === "island" && Math.hypot(b.x + 0.5 - m.x, b.y + 0.5 - m.y) < r; }
  target() { return this.near() ? { k: "board", label: "게시판 📋" } : null; }
  // 열린 부탁(아직 아무도 안 들어준 것) 수 / 내가 들어줄 수 있는 남의 부탁이 있으면 반짝
  openCount() { return RQ.list().filter(r => !r.done).length; }
  addToList(list, g, TS, camX, camY, x0, y0, x1, y1) {
    const b = this.cfg; if (b.x < x0 - 1 || b.x > x1 + 1 || b.y < y0 - 1 || b.y > y1 + 2) return;
    const n = this.openCount(), glow = RQ.list().some(r => !r.done && r.by !== state.mid);
    list.push({ y: b.y + 0.9, f: () => drawBoard(g, b.x * TS - camX, b.y * TS - camY + TS * 0.9, TS, n, glow) });
  }
}
