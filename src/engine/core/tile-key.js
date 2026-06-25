/**
 * @file The one definition of the `"x,y"` string used to key tile coordinates into Maps and Sets
 * (the spatial index, FOV's visible set, fog-of-war memory, scent save data, …). JS Maps/Sets key
 * objects by reference, not value, so a `{x,y}` object can't be used as a tile key directly — hence
 * the string encoding. Centralizing it here keeps the format in one place and gives a single seam if
 * the representation ever moves to integer keys (`y * width + x`); see docs/design/performance-notes.md.
 */

/** Encodes tile coordinates into their `"x,y"` Map/Set key. */
export const tileKey = (x, y) => `${x},${y}`;

/** Decodes an `"x,y"` tile key back into `{ x, y }` numbers. */
export function parseTileKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}
