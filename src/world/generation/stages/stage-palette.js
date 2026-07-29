/**
 * @file Palette stage: sets the terrain palette ({ floor, wall } tile ids) that later carve stages lay
 * down, and it sticks until the next palette stage. Interleave it to theme a run — e.g. a `palette`
 * setting cave tiles before the CA stages, so caSeed/caSmooth/caBridge produce a cave without any of
 * them taking tile-id parameters. See src/world/generation/palette.js and docs/howto/tile-types.md.
 *
 * Stage parameters (both optional; a slot left out keeps its current value — the palette merges):
 *   floor — the tile id to carve as floor (must be a floor-category tile).
 *   wall  — the tile id to lay as wall (must be a wall-category tile).
 *
 * Blackboard: reads + writes level:palette.
 */
import { LEVEL_PALETTE } from '../blackboard-keys.js';
import { paletteOf } from '../palette.js';
import { tileCategory } from '../../map/tile-registry.js';

/** Runs the palette stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const next = { ...paletteOf(blackboard) };
  for (const slot of ['floor', 'wall']) {
    const id = stageConfig[slot];
    if (id == null) continue;
    if (tileCategory(id) !== slot) {
      throw new Error(`palette.${slot} tile "${id}" is not a ${slot}-category tile`);
    }
    next[slot] = id;
  }
  blackboard[LEVEL_PALETTE] = next;
}
