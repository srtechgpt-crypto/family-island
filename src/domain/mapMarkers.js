export function mapMarkers(presenceAll, members, houses, myMid, nowMs) {
  if (!Number.isFinite(nowMs)) return [];
  const latest = new Map();
  for (const [place, records] of Object.entries(presenceAll ?? {})) {
    const houseMid = /^house_m[0-5]$/.test(place) ? place.slice(6) : null;
    if (place !== "island" && !houseMid) continue;
    const house = houseMid ? houses?.find(h => h.mid === houseMid) : null;
    if (houseMid && (!house || !Number.isFinite(house.door?.x) || !Number.isFinite(house.door?.y))) continue;
    for (const [ses, record] of Object.entries(records ?? {})) {
      if (!record || !/^m[0-5]$/.test(record.m) || record.m === myMid || members?.[record.m]?.ses !== ses) continue;
      if (!Number.isFinite(record.t) || nowMs - record.t > 10 * 60 * 1000) continue;
      const x = house ? house.door.x + 0.5 : record.x;
      const y = house ? house.door.y + 0.5 : record.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const previous = latest.get(record.m);
      if (previous && previous.t >= record.t) continue;
      const marker = { mid: record.m, x, y, inHouse: Boolean(house) };
      if (house) marker.houseMid = houseMid;
      latest.set(record.m, { t: record.t, marker });
    }
  }
  return [...latest.values()].map(entry => entry.marker);
}
