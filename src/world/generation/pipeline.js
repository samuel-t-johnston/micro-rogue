import { createLevel } from '../level.js';
import { run as runStatic } from './stages/stage-static.js';
import { run as runPlaceTestEntities } from './stages/stage-place-test-entities.js';

const STAGES = {
  static: runStatic,
  placeTestEntities: runPlaceTestEntities,
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
