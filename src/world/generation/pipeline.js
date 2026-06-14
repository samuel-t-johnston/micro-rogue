import { createLevel } from '../level.js';
import { run as runStatic } from './stages/stage-static.js';
import { run as runPlaceTestEntities } from './stages/stage-place-test-entities.js';
import { run as runRoomGridGeometry } from './stages/stage-room-grid-geometry.js';
import { run as runLabel } from './stages/stage-label.js';

const STAGES = {
  static: runStatic,
  placeTestEntities: runPlaceTestEntities,
  roomGridGeometry: runRoomGridGeometry,
  label: runLabel,
};

export async function runPipeline(pipelineConfig, rng, registry) {
  const level = createLevel();

  for (const stageConfig of pipelineConfig.stages) {
    const run = STAGES[stageConfig.type];
    if (!run) throw new Error(`Unknown pipeline stage type: "${stageConfig.type}"`);
    await run(level, stageConfig, level.blackboard, rng, registry);
  }

  return level;
}
