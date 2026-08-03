/**
 * @file Line-walls stage: rewrites each wall tile to the CP437 double-line variant matching which of
 * its four cardinal neighbours are walls, so glyph mode draws connected box-drawing walls (║ ╣ ╬ …).
 * Run it late — after the tile-writing structure stages — so the layout is final.
 *
 * Pure and deterministic (consumes no RNG). Any wall-category tile counts as a connecting neighbour
 * (so stone and cave walls join at a boundary), and off-grid counts as empty, so a wall on the grid
 * edge draws a clean box outline (╔═╗) rather than stubs pointing off the map. An isolated wall (no
 * wall neighbour) keeps its base id and glyph. Only tiles
 * whose id is a known line-wall family (data/tiles/line-walls.js) are rewritten; other terrain is
 * untouched. The rewrite preserves each tile's category, so the neighbour test is invariant under it —
 * a live read needs no snapshot regardless of scan order. See data/tiles/line-walls.js.
 *
 * Blackboard: reads + writes tiles.
 */
import { tileCategory } from '../../map/tile-registry.js';
import {
  LINE_WALL_FAMILIES,
  lineWallId,
  DIR_N,
  DIR_E,
  DIR_S,
  DIR_W,
} from '../../../../data/tiles/line-walls.js';

export const DEFAULTS = {};

/** Runs the line-walls stage (see the file overview). */
export function run(level) {
  const { tiles, width, height } = level;
  // Off-grid counts as empty (not wall), so an edge wall closes into a clean box outline.
  const isWall = (x, y) =>
    x >= 0 && y >= 0 && x < width && y < height && tileCategory(tiles[y][x]) === 'wall';

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = tiles[y][x];
      if (!LINE_WALL_FAMILIES.includes(base)) continue;
      let mask = 0;
      if (isWall(x, y - 1)) mask |= DIR_N;
      if (isWall(x + 1, y)) mask |= DIR_E;
      if (isWall(x, y + 1)) mask |= DIR_S;
      if (isWall(x - 1, y)) mask |= DIR_W;
      tiles[y][x] = lineWallId(base, mask);
    }
  }
}
