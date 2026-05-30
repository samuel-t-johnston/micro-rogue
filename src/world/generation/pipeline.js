import { createLevel } from '../level.js';
import { run as runStatic } from './stages/stage-static.js';

const STAGES = {
  static: runStatic,
};

export async function runPipeline(pipelineConfig, rng) {
  const level = createLevel();

  for (const stageConfig of pipelineConfig.stages) {
    const run = STAGES[stageConfig.type];
    if (!run) throw new Error(`Unknown pipeline stage type: "${stageConfig.type}"`);
    await run(level, stageConfig, level.blackboard, rng);
  }

  return level;
}
