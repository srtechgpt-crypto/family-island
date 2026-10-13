const waters = new Set(["sea", "river", "pond", "lake"]);   // lake: v8 배 위 낚시(호수 가운데)
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const time = value => Number.isSafeInteger(value);

export function pickFish(fishTable, water, rand) {
  if (!Array.isArray(fishTable) || !waters.has(water) || typeof rand !== "function") {
    throw new TypeError("잘못된 낚시 입력");
  }
  for (const fish of fishTable) {
    if (!record(fish) || typeof fish.id !== "string" || !fish.id.length || !waters.has(fish.water)
      || !Number.isFinite(fish.weight) || fish.weight < 0 || !count(fish.min) || !count(fish.max)
      || fish.min > fish.max || !Number.isSafeInteger(fish.max - fish.min + 1)) {
      throw new TypeError("잘못된 물고기 정의");
    }
  }
  const candidates = fishTable.filter(fish => fish.water === water && fish.weight > 0);
  const total = candidates.reduce((sum, fish) => sum + fish.weight, 0);
  if (!candidates.length || !Number.isFinite(total)) throw new RangeError("선택할 물고기 없음");
  const draw = () => {
    const value = rand();
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("잘못된 난수");
    return value;
  };
  const target = draw() * total;
  let cumulative = 0;
  let selected = candidates[candidates.length - 1];
  for (const fish of candidates) {
    cumulative += fish.weight;
    if (target < cumulative) { selected = fish; break; }
  }
  const size = selected.min + Math.min(selected.max - selected.min, Math.floor(draw() * (selected.max - selected.min + 1)));
  // 원본 정의를 복제하고 정수 size를 더한다. 난수 공급원은 호출자가 주입한다.
  return { ...selected, size };
}

export function judge(biteAt, pressAt, windowMs) {
  if (!time(biteAt) || !time(pressAt) || !count(windowMs)) throw new TypeError("잘못된 판정 시간");
  if (pressAt < biteAt) return "early";
  return pressAt - biteAt <= windowMs ? "hit" : "late";
}

export function updateDex(dex, fishId, size, at) {
  if (!record(dex) || typeof fishId !== "string" || !fishId.length || !count(size) || !time(at)) {
    throw new TypeError("잘못된 도감 입력");
  }
  const previous = Object.hasOwn(dex, fishId) ? dex[fishId] : undefined;
  if (previous !== undefined && (!record(previous) || !time(previous.firstAt) || !count(previous.biggest))) {
    throw new TypeError("잘못된 도감 기록");
  }
  return {
    ...dex,
    [fishId]: previous === undefined
      ? { firstAt: at, biggest: size }
      : { ...previous, biggest: Math.max(previous.biggest, size) },
  };
}
