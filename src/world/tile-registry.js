import TERRAIN from '../../data/tiles/terrain.js';

/**
 * Resolves a tile id to its terrain definition (sprite, passability, opacity, etc.).
 * @throws {Error} On an unknown tile id.
 */
export function getTileType(id) {
  const tile = TERRAIN[id];
  if (!tile) throw new Error(`Unknown tile type: "${id}"`);
  return tile;
}
