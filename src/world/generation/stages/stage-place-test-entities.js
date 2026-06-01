import { createBoulder, createDoor } from '../../furniture.js';

// Temporary stage: places test furniture for development. Replace with a proper
// population stage (see roadmap M5) once map generation matures.
export async function run(level, _stageConfig, _blackboard, _rng, registry) {
  const cx = Math.floor(level.width / 2);
  const cy = Math.floor(level.height / 2);

  level.placeEntity(createBoulder(registry, cx + 2, cy));

  // Door in the shared wall opening between the two rooms (col 5, row 3).
  level.placeEntity(createDoor(registry, 5, 3));
}
