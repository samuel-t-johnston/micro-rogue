// Draws named sprites from the catalog (data/sprites/sprite-catalog.js). A sprite name resolves to
// a sheet + grid cell; the sheet may exist at several pixel sizes ("families"), and we pick the best
// one per draw for the current zoom level and device pixel ratio. Integer upscales of pixel art stay
// crisp, so we prefer the most detailed sheet that still scales by a whole number to the on-screen
// device-pixel size.

/**
 * Choose the source sheet size for a device-pixel tile target.
 * Prefers the largest sheet that upscales to `targetPx` by a clean integer factor (max detail,
 * still crisp). With no clean divisor (fractional DPR), uses the largest sheet not exceeding the
 * target to minimise scaling; if every sheet is larger than the target, the smallest sheet.
 * @param {number} targetPx device pixels per tile (CSS tile size × devicePixelRatio)
 * @param {number[]} sizes available sheet sizes
 * @returns {number}
 */
export function pickSheetSize(targetPx, sizes) {
  const ascending = [...sizes].sort((a, b) => a - b);
  let cleanest = null;
  for (const s of ascending) {
    if (s <= targetPx && targetPx % s === 0) cleanest = s; // larger valid s wins → more detail
  }
  if (cleanest !== null) return cleanest;
  const notExceeding = ascending.filter((s) => s <= targetPx);
  return notExceeding.length ? notExceeding[notExceeding.length - 1] : ascending[0];
}

/**
 * Resolve a sprite name to the source-sheet draw it implies at a device-pixel target. Pure, so the
 * coordinate math is unit-testable without a canvas. Returns null for an unknown name (the renderer
 * then falls back to a glyph/color fill — and stale references in old saves degrade gracefully).
 * @returns {{ sheet: string, size: number, sx: number, sy: number } | null}
 */
export function resolveDraw(name, targetPx, { catalog, sheets }) {
  const entry = catalog[name];
  if (!entry) return null;
  const size = pickSheetSize(targetPx, sheets[entry.sheet]);
  return { sheet: entry.sheet, size, sx: entry.col * size, sy: entry.row * size };
}

// Distinct sheet names actually referenced by the catalog — the only sheets we load.
function referencedSheets(catalog) {
  return [...new Set(Object.values(catalog).map((e) => e.sheet))];
}

export function createSpriteRenderer({ catalog, sheets }) {
  // One image per referenced (sheet, size), each tracking its own load state.
  const images = [];
  for (const sheet of referencedSheets(catalog)) {
    for (const size of sheets[sheet]) {
      images.push({ sheet, size, img: new Image(), ready: false });
    }
  }

  // The image for (sheet, size) if loaded, else any loaded size of the same sheet (so a draw still
  // shows something before the ideal size arrives), else null.
  function readyImage(sheet, size) {
    const exact = images.find((s) => s.sheet === sheet && s.size === size && s.ready);
    return exact ?? images.find((s) => s.sheet === sheet && s.ready) ?? null;
  }

  return {
    load() {
      return Promise.all(
        images.map(
          (entry) =>
            new Promise((resolve, reject) => {
              entry.img.onload = () => { entry.ready = true; resolve(); };
              entry.img.onerror = reject;
              entry.img.src = new URL(`../../assets/sprites/${entry.sheet}-${entry.size}.png`, import.meta.url).href;
            })
        )
      );
    },

    // Draws the named sprite at screen (x, y) scaled to `size`×`size` CSS px, sourcing from the
    // sheet best suited to `size × dpr` device pixels. Returns false if the name is unknown or no
    // sheet for it is loaded, so callers fall back to a color/glyph fill.
    draw(ctx, name, x, y, size, dpr = 1) {
      const resolved = resolveDraw(name, size * dpr, { catalog, sheets });
      if (!resolved) return false;
      const sheet = readyImage(resolved.sheet, resolved.size);
      if (!sheet) return false;
      // The ready image may be a fallback size, so recompute the source rect from its actual size.
      const cell = sheet.size;
      const col = resolved.sx / resolved.size;
      const row = resolved.sy / resolved.size;
      ctx.drawImage(sheet.img, col * cell, row * cell, cell, cell, x, y, size, size);
      return true;
    },
  };
}
