import TERRAIN from '../../../data/tiles/terrain.js';
import { LINE_WALL_TILES } from '../../../data/tiles/line-walls.js';

// The base terrain plus the generated line-wall variants (data/tiles/line-walls.js). Variants are
// merged here rather than authored into terrain.js so the registry stays a single lookup for every
// consumer (renderer, describe-tile, the entity-sprites test) while terrain.js holds only base tiles.
const TILES = { ...TERRAIN, ...LINE_WALL_TILES };

/**
 * Resolves a tile id to its terrain definition (sprite, passability, opacity, etc.).
 * @throws {Error} On an unknown tile id.
 */
export function getTileType(id) {
  const tile = TILES[id];
  if (!tile) throw new Error(`Unknown tile type: "${id}"`);
  return tile;
}

/**
 * The generation-facing role of a tile ('floor' | 'wall' | …), or `null` for an undefined/unknown id.
 * Map generation branches on category, never on the concrete tile id, so a stone floor and a cave floor
 * are the same to a carve stage. Safe on off-grid reads (undefined) — callers rely on that.
 */
export function tileCategory(id) {
  return id == null ? null : (TILES[id]?.category ?? null);
}

/**
 * Whether a tile is open floor for generation. False for walls, undefined (off-grid), and unknown ids —
 * so `!isFloorTile(id)` reads any non-floor, including the grid edge, as solid. This is the single
 * predicate the carve/connectivity stages use in place of comparing ids to the literal `'floor'`.
 */
export function isFloorTile(id) {
  return tileCategory(id) === 'floor';
}
