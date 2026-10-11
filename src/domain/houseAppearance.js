const shapes = { roofShape: 'roofShapes', doorShape: 'doorShapes', windowShape: 'windowShapes', mailbox: 'mailboxes', fence: 'fences' };
const colors = { roofColor: 'roofColors', wallColor: 'wallColors', doorColor: 'doorColors' };

export function validateExterior(ext, def) {
  try {
    if (!ext || typeof ext !== 'object' || Array.isArray(ext)) return { ok: false, ext: null };
    const clean = {};
    for (const [field, list] of Object.entries(shapes)) {
      if (!def?.[list]?.includes(ext[field])) return { ok: false, ext: null };
      clean[field] = ext[field];
    }
    for (const [field, list] of Object.entries(colors)) {
      if (!Number.isInteger(ext[field]) || ext[field] < 0 || ext[field] >= def?.[list]?.length) return { ok: false, ext: null };
      clean[field] = ext[field];
    }
    return { ok: true, ext: clean };
  } catch { return { ok: false, ext: null }; }
}

export function exteriorOf(raw, mid, def) {
  const checked = validateExterior(raw, def);
  return checked.ok ? checked.ext : { ...(def.defaults[mid] ?? def.defaults.m1) };
}
