// Draws sprites from one of several fixed-resolution sheets (e.g. sprite-sheet-16.png and
// sprite-sheet-32.png), picking the best sheet per draw for the current zoom level and device
// pixel ratio. Integer upscales of pixel art stay crisp, so we prefer the most detailed sheet
// that still scales by a whole number to the on-screen device-pixel size.

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

export function createSpriteRenderer(sizes) {
  // One image per sheet size, keyed by size, each tracking its own load state.
  const sheets = sizes.map((size) => ({ size, img: new Image(), ready: false }));

  function readySheet(size) {
    const exact = sheets.find((s) => s.size === size && s.ready);
    return exact ?? sheets.find((s) => s.ready) ?? null; // any loaded sheet if the pick isn't ready
  }

  return {
    load() {
      return Promise.all(
        sheets.map(
          (sheet) =>
            new Promise((resolve, reject) => {
              sheet.img.onload = () => { sheet.ready = true; resolve(); };
              sheet.img.onerror = reject;
              sheet.img.src = new URL(`../../assets/sprites/sprite-sheet-${sheet.size}.png`, import.meta.url).href;
            })
        )
      );
    },

    // Draws `sprite` at screen (x, y) scaled to `size`×`size` CSS px, sourcing from the sheet
    // best suited to `size × dpr` device pixels. Returns false if no sheet is loaded or no sprite
    // is defined, so callers fall back to a color fill.
    draw(ctx, sprite, x, y, size, dpr = 1) {
      if (!sprite) return false;
      const pick = pickSheetSize(size * dpr, sizes);
      const sheet = readySheet(pick);
      if (!sheet) return false;
      ctx.drawImage(
        sheet.img,
        sprite.col * sheet.size, sprite.row * sheet.size, sheet.size, sheet.size,
        x, y, size, size
      );
      return true;
    },
  };
}
