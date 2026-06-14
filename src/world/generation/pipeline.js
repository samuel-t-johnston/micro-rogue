import { createLevel } from '../level.js';
import { run as runStatic } from './stages/stage-static.js';
import { run as runPlaceTestEntities } from './stages/stage-place-test-entities.js';
import { run as runRoomGridGeometry } from './stages/stage-room-grid-geometry.js';
import { run as runLabel } from './stages/stage-label.js';
import { run as runLink } from './stages/stage-link.js';

const STAGES = {
  static: runStatic,
  placeTestEntities: runPlaceTestEntities,
  roomGridGeometry: runRoomGridGeometry,
  label: runLabel,
  link: runLink,
};

// `onStageComplete(stageType, level)` (optional) fires after each stage — a debug seam for the
// generation visualizer to snapshot the level as it evolves, without stages knowing about it.
export async function runPipeline(pipelineConfig, rng, registry, { onStageComplete } = {}) {
  const level = createLevel();

  for (const stageConfig of pipelineConfig.stages) {
    const run = STAGES[stageConfig.type];
    if (!run) throw new Error(`Unknown pipeline stage type: "${stageConfig.type}"`);
    await run(level, stageConfig, level.blackboard, rng, registry);
    onStageComplete?.(stageConfig.type, level);
  }

  return level;
}
