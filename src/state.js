// 앱 전체가 함께 보는 상태
export const state = {
  user: null,          // Firebase 사용자
  fid: null,           // 가족 ID
  mid: null,           // 내 자리
  ses: null,           // 내 세션
  isAdmin: false,
  player: null,        // players/{mid} (migrate된 모양)
  members: {},         // members/*
  place: "island",     // island | house_mX
  room: "living",
  kicked: false,
};
const subs = new Set();
export const onState = f => { subs.add(f); return () => subs.delete(f); };
export const emit = (what) => subs.forEach(f => f(what));
