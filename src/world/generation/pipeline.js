/**
 * @file The map-generation pipeline runner: maps a pipeline config's ordered stage types to their
 * stage functions and runs each against a fresh level, threading a shared blackboard. Register a
 * stage type in STAGES to make it usable from a pipeline config.
 */
import { createLevel } from '../map/level.js';
import * as staticStage from './stages/stage-static.js';
import * as randomStatic from './stages/stage-random-static.js';
import * as placeStaticEntities from './stages/stage-place-static-entities.js';
import * as roomGridGeometry from './stages/stage-room-grid-geometry.js';
import * as label from './stages/stage-label.js';
import * as link from './stages/stage-link.js';
import * as carveRooms from './stages/stage-carve-rooms.js';
import * as carveHalls from './stages/stage-carve-halls.js';
import * as bspGeometry from './stages/stage-bsp-geometry.js';
import * as bspCarve from './stages/stage-bsp-carve.js';
import * as layoutNodes from './stages/stage-layout-nodes.js';
import * as layoutEdges from './stages/stage-layout-edges.js';
import * as carveChambers from './stages/stage-carve-chambers.js';
import * as carveCorridors from './stages/stage-carve-corridors.js';
import * as caSeed from './stages/stage-ca-seed.js';
import * as caSmooth from './stages/stage-ca-smooth.js';
import * as caBridge from './stages/stage-ca-bridge.js';
import * as segmentRegions from './stages/stage-segment-regions.js';
import * as box from './stages/stage-box.js';
import * as stitch from './stages/stage-stitch.js';
import * as reserve from './stages/stage-reserve.js';
import * as stairs from './stages/stage-stairs.js';
import * as spawn from './stages/stage-spawn.js';
import * as populate from './stages/stage-populate.js';
import * as scaleCreatures from './stages/stage-scale-creatures.js';
import * as loadout from './stages/stage-loadout.js';

// Stage type -> its module ({ run, DEFAULTS? }). The registries below derive from this single map, so
// a stage is registered — and its defaults surfaced to the map-gen visualizer — in exactly one place.
const MODULES = {
  static: staticStage,
  randomStatic,
  placeStaticEntities,
  roomGridGeometry,
  label,
  link,
  carveRooms,
  carveHalls,
  bspGeometry,
  bspCarve,
  layoutNodes,
  layoutEdges,
  carveChambers,
  carveCorridors,
  caSeed,
  caSmooth,
  caBridge,
  segmentRegions,
  box,
  stitch,
  reserve,
  stairs,
  spawn,
  populate,
  scaleCreatures,
  loadout,
};

const STAGES = Object.fromEntries(Object.entries(MODULES).map(([type, m]) => [type, m.run]));

/**
 * Stage type -> its default config: the stage's own `DEFAULTS` export, or `{}` when it takes no
 * parameters. One source of truth with the stage code (a stage owns its defaults), so the map-gen
 * visualizer's "add stage" can insert real, current defaults without ever drifting.
 */
export const STAGE_DEFAULTS = Object.fromEntries(
  Object.entries(MODULES).map(([type, m]) => [type, m.DEFAULTS ?? {}]),
);

/** The registered stage type names, in registry order — for the visualizer's stage picker. */
export const STAGE_TYPES = Object.keys(MODULES);

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
