// 집 위치·겉모습(housing): 가족 공유. 위치는 housing/rev(+1)와 함께 한 번에 저장해서 동시에 옮겨도 겹치지 않게
import { db, ref, get, update, set, onValue, fpath, rid } from "./fb.js";
import { planHouseMove } from "../domain/housing.js";
import { state, emit } from "../state.js";

let unsub = null;
export function watchHousing() {
  if (unsub) return Promise.resolve();
  return new Promise(resolve => {
    let first = true;
    unsub = onValue(ref(db, fpath(state.fid, "housing")), s => {
      state.housing = s.val() || {};
      emit("housing");
      if (first) { first = false; resolve(); }
    }, () => { state.housing = state.housing || {}; if (first) { first = false; resolve(); } });
  });
}

// 저장 직전 최신 housing을 다시 읽어 check(최신값)로 판정 → 통과하면 위치+rev 함께 저장
// 규칙이 rev 불일치(누가 먼저 옮김)를 거절하면 한 번 더 시도
export async function moveHouse(pos, check) {
  const req = "h_" + rid(10);
  for (let tryNo = 0; tryNo < 2; tryNo++) {
    const latest = (await get(ref(db, fpath(state.fid, "housing")))).val() || {};
    const c = check(latest);
    if (!c.ok) return c;
    try {
      await update(ref(db, fpath(state.fid, "housing")), planHouseMove(latest, state.mid, pos, req));
      return { ok: true };
    } catch (e) {
      // 거절: 그새 누가 옮겼거나 연결 문제 → 내 요청이 들어갔는지 확인
      const mine = (await get(ref(db, fpath(state.fid, "housing", "houses", state.mid, "pos")))).val();
      if (mine && mine.req === req) return { ok: true };
    }
  }
  return { ok: false, reason: "busy" };
}

export async function saveExterior(ext) {
  await set(ref(db, fpath(state.fid, "housing", "houses", state.mid, "ext")), { ...ext, ses: state.ses });
}
