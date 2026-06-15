import { createLevel } from '../level.js';
import { run as runStatic } from './stages/stage-static.js';
import { run as runPlaceTestEntities } from './stages/stage-place-test-entities.js';
import { run as runRoomGridGeometry } from './stages/stage-room-grid-geometry.js';
import { run as runLabel } from './stages/stage-label.js';
import { run as runLink } from './stages/stage-link.js';
import { run as runCarveRooms } from './stages/stage-carve-rooms.js';
import { run as runCarveHalls } from './stages/stage-carve-halls.js';
import { run as runSpawn } from './stages/stage-spawn.js';

const STAGES = {
  static: runStatic,
  placeTestEntities: runPlaceTestEntities,
  roomGridGeometry: runRoomGridGeometry,
  label: runLabel,
  link: runLink,
  carveRooms: runCarveRooms,
  carveHalls: runCarveHalls,
  spawn: runSpawn,
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
