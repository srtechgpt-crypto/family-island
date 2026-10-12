export const CURRENT_VERSION = 1;
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function migrate(data, fromVersion = 0) {
  if (!Number.isSafeInteger(fromVersion) || fromVersion < 0) return { ok: false, reason: "잘못된 버전" };
  if (fromVersion > CURRENT_VERSION) return { ok: false, reason: "새 버전 앱 필요" };
  if (!record(data)) return { ok: false, reason: "잘못된 데이터" };
  const next = { ...data };
  for (const field of ["inv", "furn", "dex", "applied", "done", "cookDex", "insectDex", "insectVisit", "camp", "roast", "farmPend"]) {
    if (next[field] === undefined) next[field] = {};
    if (!record(next[field])) return { ok: false, reason: "잘못된 데이터" };
    next[field] = { ...next[field] };
  }
  if (next.rev === undefined) next.rev = 0;
  if (!Number.isSafeInteger(next.rev) || next.rev < 0) return { ok: false, reason: "잘못된 데이터" };
  return { ok: true, data: next, version: CURRENT_VERSION };
}
