/**
 * @file Structure stage: loads a single fixed map layout. Tiles go straight into the level (at the
 * optional `bounds` offset, so a static block composes into an already-generated level); authored
 * entities are stashed on the blackboard for the place-static-entities stage; and any authored regions
 * are merged into the zone/room contract (with the stage's `section`) so the shared tail works over
 * the hand-authored rooms. See docs/howto/static-map-layouts.md.
 *
 * Stage parameters (all optional):
 *   layout       — map file name (without .js).
 *   bounds       — {x,y,w,h}: stamp the layout here in an in-progress level instead of owning the grid.
 *   section      — district id stamped on the layout's authored zones (for scoped label/populate).
 *   importLayout — injected module importer (tests); defaults to the URL-based dynamic import.
 */
import { loadStaticLayout } from '../static-layout.js';
import { publishStatic } from './static-publish.js';

/** Runs the static structure stage (see the file overview). */
export async function run(level, stageConfig, blackboard) {
  const result = await loadStaticLayout(
    stageConfig.layout,
    level,
    stageConfig.importLayout,
    stageConfig.bounds,
  );
  publishStatic(blackboard, result, stageConfig);
}
