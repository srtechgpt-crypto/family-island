// 내 데이터(players/{mid}): 구독 + 트랜잭션. 계산은 domain 함수가 맡는다.
import { db, ref, onValue, runTransaction, fpath, rid, serverNow } from "./fb.js";
import { migrate } from "../domain/migrate.js";
import { applyClaim } from "../domain/rewards.js";
import { craft } from "../domain/crafting.js";
import { place, store, rotate } from "../domain/placement.js";
import { addItems } from "../domain/inventory.js";
import { updateDex } from "../domain/fishing.js";
import { cook, eat } from "../domain/cooking.js";
import { applyRoast } from "../domain/campfire.js";
import { applyCatch, markFled, releaseInsect } from "../domain/insects.js";
import { removeItems } from "../domain/inventory.js";
import { sewOutfit } from "../domain/outfits.js";
import { state, emit } from "../state.js";

export const norm = raw => {
  const r = migrate(raw || {}, raw && raw.rev !== undefined ? 1 : 0);
  if (!r.ok) throw new Error(r.reason);
  return r.data;
};

// 다른 가족 데이터 읽기(놀러 가기)
export function watchPlayer(mid, cb) {
  return onValue(ref(db, fpath(state.fid, "players", mid)), s => cb(norm(s.val())), () => cb(null));
}

let ready = null;
export function startPlayer() {
  ready = new Promise(resolve => {
    let first = true;
    onValue(ref(db, fpath(state.fid, "players", state.mid)), s => {
      state.player = norm(s.val());
      emit("player");
      if (first) { first = false; resolve(); }
    });
  });
  return ready;
}

// fn(player) → {ok, player, changed?, reason}. 서버가 받아들여야 성공.
async function tx(fn) {
  await ready;
  if (state.kicked) return { ok: false, reason: "다른 기기에서 들어옴" };
  let result = null;
  const res = await runTransaction(ref(db, fpath(state.fid, "players", state.mid)), cur => {
    let base;
    try { base = norm(cur); } catch (e) { result = { ok: false, reason: e.message }; return; }
    const r = fn(base);
    result = r;
    if (!r.ok || r.changed === false) return;          // 그만두기(쓰지 않음)
    return { ...r.player, ses: state.ses };
  }, { applyLocally: false });
  if (!result) return { ok: false, reason: "처리 못 함" };
  if (result.ok && result.changed !== false && !res.committed) return { ok: false, reason: "저장 실패" };
  return result;
}

// 목장(farmStore)이 쓰는 개인 트랜잭션
export const farmTx = fn => tx(fn);

export const giveClaim = claim => tx(p => applyClaim(p, claim, state.mid, Math.max(serverNow(), claim.at || 0)));

export function craftFurniture(recipeId, recipes) {
  const fid = "f_" + rid(10), req = "c_" + rid(10);
  return tx(p => craft(p, recipeId, recipes, fid, req));
}

export const placeFurniture = (room, defs, furnId, x, y, rot) => tx(p => place(room, defs, p, furnId, x, y, rot));
export const storeFurniture = furnId => tx(p => store(p, furnId));
export const rotateFurniture = (room, defs, furnId) => tx(p => rotate(room, defs, p, furnId));

// 물고기: 가방 + 도감을 한 번에(rev 한 번)
export function addFish(fish, at) {
  const req = "fish_" + rid(10);
  return tx(p => {
    if (p.done[req]) return { ok: true, player: p, changed: false };
    const a = addItems(p.inv, { [fish.id]: 1 });
    if (!a.ok) return a;
    const first = !p.dex[fish.id];
    return { ok: true, first, player: { ...p, inv: a.inv, dex: updateDex(p.dex, fish.id, fish.size, at), rev: p.rev + 1 } };
  });
}

// 처음 들어온 사람: 빈 데이터 만들기
export const ensurePlayer = () => tx(p => p.rev > 0 ? { ok: true, player: p, changed: false } : { ok: true, player: { ...p, rev: 1 } });

// ---- 버전 3 ----
// 요리: 재료 차감 + 요리 1개
export function cookDish(recipeId, cooking, items) { const req = "k_" + rid(10); return tx(p => cook(p, recipeId, cooking, items, req)); }
// 먹기: 1개 차감 + 요리 도감
export async function eatFood(itemId, items, at) {
  const req = "e_" + rid(10), first = !(state.player && state.player.cookDex && state.player.cookDex[itemId]);
  const r = await tx(p => eat(p, itemId, items, req, at));
  return { ...r, first };
}
// 마시멜로 결과(하루 3번)
export async function saveRoast(day, result) {
  const req = "r_" + rid(10); let n = 0;
  const r = await tx(p => { n = (p.camp && p.camp[day] && p.camp[day].n) || 0; return applyRoast(p, day, result, req); });
  return { ...r, n };   // n: 오늘 몇 번째(0~2) — 가족 추억 기록 자리
}
// 곤충
export async function catchInsect(inst, slot, at) {
  const req = "i_" + rid(10), first = !(state.player && state.player.insectDex && state.player.insectDex[inst.species]);
  const r = await tx(p => applyCatch(p, inst, slot, req, at));
  return { ...r, first };
}
export const fleeInsect = (instId, slot) => tx(p => markFled(p, instId, slot));
export function freeInsect(itemId) { const req = "x_" + rid(10); return tx(p => releaseInsect(p, itemId, req)); }
// 캠프 점화 뒤 나뭇가지 1개(그날 한 번, 같은 세션에서만)
export function payIgnition(day) {
  const req = "ignite_" + day;
  return tx(p => {
    if (p.done[req]) return { ok: true, player: p, changed: false };
    const r = removeItems(p.inv, { branch: 1 });
    if (!r.ok) return { ok: true, player: p, changed: false };   // 없으면 공짜 불
    return { ok: true, player: { ...p, inv: r.inv, done: { ...p.done, [req]: true }, rev: p.rev + 1 } };
  });
}

// ---- 버전 8 ----
// 옷 만들기: 옷감 1 + 물감 1 → 무늬 윗옷
export function sew(pattern, dye) { const req = "w_" + rid(10); return tx(p => sewOutfit(p, pattern, dye, req)); }
