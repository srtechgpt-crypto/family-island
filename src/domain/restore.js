// 백업 복원 병합(순수 함수)
// 백업 내용으로 되돌리되, 백업에 없는 기록(옛 백업의 요리·곤충 도감 등)은 지금 것을 둔다.
// 곤충 조각(insectVisit)·오늘 마시멜로 횟수(camp)·구운 기록(roast)은 되돌리면 규칙·가족 추억과 어긋나서 항상 지금 것을 유지
export function restoreMerge(cur, p, ses) {
  const now = cur || {};
  const out = { ...now, ...p };
  for (const k of ["insectVisit", "camp", "roast"]) { if (now[k] !== undefined) out[k] = now[k]; else delete out[k]; }
  out.rev = Math.max(+now.rev || 0, +p.rev || 0) + 1;
  out.ses = ses || null;
  return out;
}
