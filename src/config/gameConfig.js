// 가족 자리·앱 버전 등 고정 설정
export const APP_VERSION = 8;   // 6: 밭 칸 위치·열매 수 / 7: 목장(텃밭·닭·애완동물)·돌밭 / 8: 만든 옷(appearance.outfit)·부탁 게시판(helped·reqMine)
export const FAMILY = [
  { mid: "m0", name: "할머니", color: "#c77d4a" },
  { mid: "m1", name: "아빠", color: "#3d6fb6" },
  { mid: "m2", name: "엄마", color: "#d8608a" },
  { mid: "m3", name: "첫째", color: "#8a5cc7" },
  { mid: "m4", name: "둘째", color: "#e08a2c" },
  { mid: "m5", name: "셋째", color: "#2fa37a" },
];
export const ADMIN_MID = "m1";           // 가족을 만든 관리자(아빠)의 자리
export const FISH_WINDOW = { default: 800, m5: 1200 };  // 낚시 판정(ms). 막내는 실제 시험 후 조정
export const MOVE_SEND_HZ = 4;
export const WEEDS_PER_DAY = 40;
export const familyOf = mid => FAMILY.find(f => f.mid === mid);
// 공개 코드에는 호칭만 둔다. 실제 이름은 아빠가 가족 관리에서 넣고(members/{mid}/name) 게임 안에서만 보인다.
import { state } from "../state.js";
export const nameOf = mid => (state.members[mid] && state.members[mid].name) || (familyOf(mid) || {}).name || "?";

// 받침에 맞는 조사: josa("왕귀뚜라미", "을", "를") → "왕귀뚜라미를"
export function josa(word, withBatchim, without) {
  const c = String(word).charCodeAt(String(word).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withBatchim : without);
}
