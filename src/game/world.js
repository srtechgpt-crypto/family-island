// 섬 지도 불러오기 + 걸을 수 있는지 + 물건 찾기
import { zoneOf } from "../domain/rounds.js";
import { WEEDS_PER_DAY } from "../config/gameConfig.js";

export const T = { SEA: 0, SAND: 1, GRASS: 2, RIVER: 3, PATH: 4, POND: 5, BRIDGE: 6, ROCK: 7 };
const WALK = new Set([T.SAND, T.GRASS, T.PATH, T.BRIDGE]);
export const WATER = { [T.SEA]: "sea", [T.RIVER]: "river", [T.POND]: "pond" };

export class World {
  constructor(map) {
    this.map = map;
    this.w = map.w; this.h = map.h;
    this.tiles = map.tiles;
    this.houses = map.houses;
    this.objects = map.objects;
    this.solid = new Uint8Array(this.w * this.h);
    this.objAt = new Map();
    for (const o of this.objects) {
      o.zone = zoneOf(o.x, o.y);
      this.objAt.set(o.x + "," + o.y, o);
      if (o.k === "tree" || o.k === "rock") this.solid[o.y * this.w + o.x] = 1;
    }
    for (const h of this.houses) for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) this.solid[y * this.w + x] = 1;
    this.weedRound = null; this.weeds = [];
  }
  tile(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? T.SEA : this.tiles[y * this.w + x]; }
  walkable(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return WALK.has(this.tile(tx, ty)) && !this.solid[ty * this.w + tx]; }
  houseOf(mid) { return this.houses.find(h => h.mid === mid); }

  // 오늘의 잡초 자리(회차마다 바뀜, 가족 모두 같은 자리)
  weedsFor(round) {
    if (round === this.weedRound) return this.weeds;
    let s = 0; for (const c of round) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const out = [], used = new Set();
    let tries = 0;
    while (out.length < WEEDS_PER_DAY && tries++ < 5000) {
      const x = Math.floor(rnd() * this.w), y = Math.floor(rnd() * this.h);
      const k = x + "," + y;
      if (this.tile(x, y) !== T.GRASS || this.solid[y * this.w + x] || this.objAt.has(k) || used.has(k) || this.nearHouse(x, y)) continue;
      used.add(k);
      out.push({ id: `w${x}_${y}`, k: "weed", x, y, zone: zoneOf(x, y) });
    }
    this.weedRound = round; this.weeds = out;
    return out;
  }
  nearHouse(x, y) { return this.houses.some(h => x >= h.x - 1 && x <= h.x + h.w && y >= h.y - 1 && y <= h.y + h.h + 2); }
}

export async function loadWorld() {
  const res = await fetch("data/island.json");
  if (!res.ok) throw new Error("지도를 못 불러왔어요");
  return new World(await res.json());
}
