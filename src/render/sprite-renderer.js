// Draws sprites from a fixed-resolution sheet. `sourceSize` is the sheet's cell size in px
// (the sprite-sheet-<sourceSize>.png file); the draw target size is passed per call so the
// same sheet can be scaled to any zoom level. Integer dest/source ratios keep pixel art crisp.
export function createSpriteRenderer(sourceSize) {
  const img = new Image();
  let ready = false;

  return {
    load() {
      return new Promise((resolve, reject) => {
        img.onload = () => { ready = true; resolve(); };
        img.onerror = reject;
        img.src = new URL(`../../assets/sprites/sprite-sheet-${sourceSize}.png`, import.meta.url).href;
      });
    },

    // Draws `sprite` at screen (x, y) scaled to `size`×`size`. Returns false if the sprite
    // could not be drawn (not loaded or no sprite defined); callers fall back to a color fill.
    draw(ctx, sprite, x, y, size) {
      if (!ready || !sprite) return false;
      ctx.drawImage(
        img,
        sprite.col * sourceSize, sprite.row * sourceSize, sourceSize, sourceSize,
        x, y, size, size
      );
      return true;
    },
  };
}
