// 버전 12 꽃 섞어 심기(순수 함수): 마당에 가로·세로로 붙은 서로 다른 색 꽃 → 이 회차에 새 색 꽃이 필 수 있음
// 지급은 하루 claims(claims/{round}/z99_99/bloom_{주인}_{a}_{b}, by = 주인) — 규칙이 주인만 쓰게 막음
import { fnv1a32 } from "./forage.js";

export const BLOOM_ZONE = "z99_99";
const mixOf = (cfg, a, b) => cfg.mix.find(m => (m.a === a && m.b === b) || (m.a === b && m.b === a)) || null;

// plants = validYard 결과 중 꽃(f.type이 꽃 심기, defs[type].flower = 색). round = "YYYYMMDD" 회차
export function blooms(round, owner, plants, defs, cfg) {
  const r = Number(round), list = [];
  const cellOf = new Map();
  for (const p of plants) {
    const color = defs[p.f.type] && defs[p.f.type].flower;
    if (!color || !Number.isSafeInteger(p.f.pr) || p.f.pr >= r) continue;   // 심은(옮긴) 회차가 지나야
    cellOf.set(p.cells[0][0] + "," + p.cells[0][1], { id: p.id, color, x: p.cells[0][0], y: p.cells[0][1] });
  }
  const seen = new Set();
  for (const a of cellOf.values()) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const b = cellOf.get((a.x + dx) + "," + (a.y + dy)); if (!b || a.color === b.color) continue;
    const [p, q] = a.id < b.id ? [a, b] : [b, a], pid = `bloom_${owner}_${p.id}_${q.id}`;
    if (seen.has(pid)) continue; seen.add(pid);
    const mix = mixOf(cfg, a.color, b.color); if (!mix) continue;
    const h = fnv1a32(`${round}|${pid}`);
    if (h % 100 >= (mix.chance ?? cfg.chance)) continue;
    list.push({ pid, item: "flower_" + mix.out, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, h });
  }
  return list.sort((u, v) => u.h - v.h || (u.pid < v.pid ? -1 : 1)).slice(0, cfg.maxPerDay);
}
