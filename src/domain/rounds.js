const validRound = value => {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// KST(UTC+9)에서 5시간을 빼면 UTC+4의 날짜가 해당 회차다.
export function roundOf(serverMs) {
  if (!Number.isSafeInteger(serverMs)) throw new TypeError("잘못된 서버 시간");
  const date = new Date(serverMs + 4 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(year) || year < 0 || year > 9999) throw new RangeError("날짜 범위 초과");
  return `${String(year).padStart(4, "0")}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isAvailable(lastTakenRound, currentRound) {
  if (!validRound(currentRound)) throw new TypeError("잘못된 회차");
  if (lastTakenRound === undefined || lastTakenRound === null || lastTakenRound === "") return true;
  if (!validRound(lastTakenRound)) throw new TypeError("잘못된 회차");
  return lastTakenRound < currentRound;
}

export function claimId(round, zone, nodeId) {
  if (!validRound(round) || typeof zone !== "string" || !zone.length || typeof nodeId !== "string" || !nodeId.length) {
    throw new TypeError("잘못된 보상 ID 입력");
  }
  return `c_${round}_${zone}_${nodeId}`;
}

export function zoneOf(tileX, tileY) {
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY)) throw new TypeError("잘못된 타일 좌표");
  return `z${Math.floor(tileX / 16)}_${Math.floor(tileY / 16)}`;
}
