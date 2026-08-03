/**
 * @file Line (CP437 double-line) wall variants: for each base wall family, a set of tiles that differ
 * from the base only in `glyph`, so a wall renders as the box-drawing segment (║ ╣ ╬ …) matching which
 * of its four cardinal neighbours are also walls. The `lineWalls` generation stage picks the variant
 * per tile from a 4-bit N/E/S/W mask; these defs are merged into the tile registry (tile-registry.js)
 * so every variant resolves like any other terrain. Glyph-first: each variant reuses its base family's
 * sprite, so sprite mode is unchanged and only glyph mode shows the lines. See
 * src/world/generation/stages/stage-line-walls.js and docs/howto/tile-types.md.
 */
import TERRAIN from './terrain.js';

// The base wall tiles that get a line-drawing family. Any wall-category tile could, but only these
// ship variants today.
export const LINE_WALL_FAMILIES = ['wall', 'cave-wall'];

// 4-bit cardinal mask: N=1, E=2, S=4, W=8. Index the tables below by mask value (0–15).
export const DIR_N = 1;
export const DIR_E = 2;
export const DIR_S = 4;
export const DIR_W = 8;

// Double-line CP437 glyph per mask. Single-side masks collapse to the straight-through glyph
// (N-only/S-only → ║, E-only/W-only → ═), the conventional choice. Mask 0 (isolated) has no entry —
// lineWallId returns the base id for it, so an isolated wall keeps its base glyph (e.g. '#').
const GLYPHS = [
  null, //  0  (isolated → base tile, unused)
  '║', //  1  N
  '═', //  2  E
  '╚', //  3  N E
  '║', //  4  S
  '║', //  5  N S
  '╔', //  6  E S
  '╠', //  7  N E S
  '═', //  8  W
  '╝', //  9  N W
  '═', // 10  E W
  '╩', // 11  N E W
  '╗', // 12  S W
  '╣', // 13  N S W
  '╦', // 14  E S W
  '╬', // 15  N E S W
];

// Id suffix per mask: the connected directions in N-E-S-W order (wall-nes, cave-wall-ew, …).
const SUFFIX = [
  'none',
  'n',
  'e',
  'ne',
  's',
  'ns',
  'es',
  'nes',
  'w',
  'nw',
  'ew',
  'new',
  'sw',
  'nsw',
  'esw',
  'nesw',
];

/**
 * The line-wall variant tile id for `baseId` at neighbour `mask`, or `baseId` itself for an isolated
 * wall (mask 0) or a base outside {@link LINE_WALL_FAMILIES} — so callers can pass any tile and get a
 * valid id back.
 */
export function lineWallId(baseId, mask) {
  if (mask === 0 || !LINE_WALL_FAMILIES.includes(baseId)) return baseId;
  return `${baseId}-${SUFFIX[mask]}`;
}

/**
 * Tile-id -> tile def for every family × mask 1–15 (15 per family). Each variant inherits its base
 * def — name, colours, symbol, passability, opacity, category, and sprite — and overrides only `glyph`,
 * so gameplay and sprite rendering are identical to the base wall; merged into the tile registry.
 */
export const LINE_WALL_TILES = Object.fromEntries(
  LINE_WALL_FAMILIES.flatMap((base) => {
    const baseDef = TERRAIN[base];
    return Array.from({ length: 15 }, (_, i) => {
      const mask = i + 1;
      return [`${base}-${SUFFIX[mask]}`, { ...baseDef, glyph: GLYPHS[mask] }];
    });
  }),
);
