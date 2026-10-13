export const HAIR_STYLES = ["bun", "short", "long", "pony", "pig", "bob"];
export const BOTTOM_TYPES = ["pants", "skirt"];
export const HAIR_COLORS = 8;
export const CLOTH_COLORS = 12;
// v8: 내가 만든 윗옷(아이템 id). 없으면 기존 윗옷 색
export const OUTFIT_RE = /^outfit_(plain|stripe|dot)_(red|yellow|white|green|orange|pink)$/;

const defaults = [
  ["bun", 6, 8, "pants", 10],
  ["short", 1, 6, "pants", 10],
  ["long", 3, 0, "skirt", 9],
  ["pony", 2, 7, "pants", 10],
  ["pig", 2, 1, "skirt", 2],
  ["bob", 1, 4, "skirt", 5],
];

export function defaultAppearance(mid) {
  const index = typeof mid === "string" && /^m[0-5]$/.test(mid) ? Number(mid[1]) : 1;
  const [hairStyle, hairColor, topColor, bottomType, bottomColor] = defaults[index];
  return { v: 1, hairStyle, hairColor, topColor, bottomType, bottomColor };
}

export function validateAppearance(a) {
  try {
    if (!a || typeof a !== "object" || Array.isArray(a)) return { ok: false, reason: "외형 객체 필요" };
    const { v, hairStyle, hairColor, topColor, bottomType, bottomColor, outfit } = a;
    if (v !== 1) return { ok: false, reason: "외형 버전 오류" };
    if (!HAIR_STYLES.includes(hairStyle)) return { ok: false, reason: "머리 모양 오류" };
    if (!BOTTOM_TYPES.includes(bottomType)) return { ok: false, reason: "아래옷 종류 오류" };
    const color = (n, max) => Number.isInteger(n) && n >= 0 && n < max;
    if (!color(hairColor, HAIR_COLORS) || !color(topColor, CLOTH_COLORS) || !color(bottomColor, CLOTH_COLORS)) {
      return { ok: false, reason: "색 번호 오류" };
    }
    if (outfit !== undefined && (typeof outfit !== "string" || !OUTFIT_RE.test(outfit))) return { ok: false, reason: "옷 오류" };
    return { ok: true, appearance: { v, hairStyle, hairColor, topColor, bottomType, bottomColor, ...(outfit ? { outfit } : {}) } };
  } catch {
    return { ok: false, reason: "외형을 읽을 수 없음" };
  }
}

export function appearanceOf(raw, mid) {
  const result = validateAppearance(raw);
  return result.ok ? result.appearance : defaultAppearance(mid);
}
