const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validCounts = value => isRecord(value) && Object.values(value).every(
  count => Number.isSafeInteger(count) && count >= 0,
);
const invalid = () => ({ ok: false, reason: "잘못된 수량" });
const compact = entries => Object.fromEntries([...entries].filter(([, count]) => count > 0));

// items는 inv와 같은 { 아이템ID: 수량 } 형태다. 수량 0은 허용한다.
export function addItems(inv, items) {
  if (!validCounts(inv) || !validCounts(items)) return invalid();
  const next = new Map(Object.entries(inv));
  for (const [id, count] of Object.entries(items)) {
    const total = (next.get(id) ?? 0) + count;
    if (!Number.isSafeInteger(total)) return invalid();
    next.set(id, total);
  }
  return { ok: true, inv: compact(next) };
}

export function removeItems(inv, items) {
  if (!validCounts(inv) || !validCounts(items)) return invalid();
  const missing = Object.fromEntries(Object.entries(items)
    .map(([id, count]) => [id, Math.max(0, count - (Object.hasOwn(inv, id) ? inv[id] : 0))])
    .filter(([, count]) => count > 0));
  if (Object.keys(missing).length) return { ok: false, reason: "부족", missing };
  const next = new Map(Object.entries(inv));
  for (const [id, count] of Object.entries(items)) next.set(id, (next.get(id) ?? 0) - count);
  return { ok: true, inv: compact(next) };
}

export function hasItems(inv, items) {
  const checked = removeItems(inv, items);
  if (!checked.ok) return checked;
  return { ok: true, inv: compact(Object.entries(inv)) };
}
