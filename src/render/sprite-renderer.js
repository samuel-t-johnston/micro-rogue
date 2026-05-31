export function createSpriteRenderer(tileSize) {
  const img = new Image();
  let ready = false;

  return {
    load() {
      return new Promise((resolve, reject) => {
        img.onload = () => { ready = true; resolve(); };
        img.onerror = reject;
        img.src = `/assets/sprites/sprite-sheet-${tileSize}.png`;
      });
    },

    // Returns false if the sprite could not be drawn (not loaded or no sprite defined).
    // Callers should fall back to a solid color fill in that case.
    draw(ctx, sprite, x, y) {
      if (!ready || !sprite) return false;
      ctx.drawImage(
        img,
        sprite.col * tileSize, sprite.row * tileSize, tileSize, tileSize,
        x, y, tileSize, tileSize
      );
      return true;
    },
  };
}
