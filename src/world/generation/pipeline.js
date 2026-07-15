/**
 * @file The map-generation pipeline runner: maps a pipeline config's ordered stage types to their
 * stage functions and runs each against a fresh level, threading a shared blackboard. Register a
 * stage type in STAGES to make it usable from a pipeline config.
 */
import { createLevel } from '../map/level.js';
import { run as runStatic } from './stages/stage-static.js';
import { run as runRandomStatic } from './stages/stage-random-static.js';
import { run as runPlaceStaticEntities } from './stages/stage-place-static-entities.js';
import { run as runRoomGridGeometry } from './stages/stage-room-grid-geometry.js';
import { run as runLabel } from './stages/stage-label.js';
import { run as runLink } from './stages/stage-link.js';
import { run as runCarveRooms } from './stages/stage-carve-rooms.js';
import { run as runCarveHalls } from './stages/stage-carve-halls.js';
import { run as runBspGeometry } from './stages/stage-bsp-geometry.js';
import { run as runBspCarve } from './stages/stage-bsp-carve.js';
import { run as runStairs } from './stages/stage-stairs.js';
import { run as runSpawn } from './stages/stage-spawn.js';
import { run as runPopulate } from './stages/stage-populate.js';
import { run as runScaleCreatures } from './stages/stage-scale-creatures.js';
import { run as runLoadout } from './stages/stage-loadout.js';

const STAGES = {
  static: runStatic,
  randomStatic: runRandomStatic,
  placeStaticEntities: runPlaceStaticEntities,
  roomGridGeometry: runRoomGridGeometry,
  label: runLabel,
  link: runLink,
  carveRooms: runCarveRooms,
  carveHalls: runCarveHalls,
  bspGeometry: runBspGeometry,
  bspCarve: runBspCarve,
  stairs: runStairs,
  spawn: runSpawn,
  populate: runPopulate,
  scaleCreatures: runScaleCreatures,
  loadout: runLoadout,
};

/**
 * Runs a pipeline config's stages in order against a fresh level and returns it.
 * `onStageComplete(stageType, level)` (optional) fires after each stage — a debug seam for the
 * generation visualizer to snapshot the level as it evolves, without stages knowing about it.
 * `identity` ({ branch, depth }) stamps the level's place in the dungeon; the pipeline id and the
 * rng's derived seed are captured automatically so a frozen level carries its full identity.
 * @throws {Error} On an unknown stage type.
 */
export async function runPipeline(
  pipelineConfig,
  rng,
  registry,
  { onStageComplete, identity } = {},
) {
  const level = createLevel({
    branch: identity?.branch ?? null,
    depth: identity?.depth ?? null,
    pipelineId: pipelineConfig.id ?? null,
    seed: rng?.getSeed?.() ?? null,
  });

  for (const stageConfig of pipelineConfig.stages) {
    const run = STAGES[stageConfig.type];
    if (!run) throw new Error(`Unknown pipeline stage type: "${stageConfig.type}"`);
    await run(level, stageConfig, level.blackboard, rng, registry);
    onStageComplete?.(stageConfig.type, level);
  }

  return level;
}
