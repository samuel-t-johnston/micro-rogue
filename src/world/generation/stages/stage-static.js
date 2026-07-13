/**
 * @file Structure stage: loads a single fixed map layout. Tiles go straight into the level; the
 * layout's authored entities are stashed on the blackboard for the place-static-entities stage to
 * instantiate.
 */
import { loadStaticLayout } from '../static-layout.js';
import { STATIC_ENTITIES } from '../blackboard-keys.js';

/** Runs the static structure stage (see the file overview). */
export async function run(level, stageConfig, blackboard) {
  blackboard[STATIC_ENTITIES] = await loadStaticLayout(
    stageConfig.layout,
    level,
    stageConfig.importLayout,
  );
}
