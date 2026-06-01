import { createBoulder, createDoor } from '../../furniture.js';
import { createPotion } from '../../items.js';

// Temporary stage: places test furniture and items for development. Replace with a proper
// population stage (see roadmap M5) once map generation matures.
export async function run(level, _stageConfig, _blackboard, _rng, registry) {
  const cx = Math.floor(level.width / 2);
  const cy = Math.floor(level.height / 2);

  level.placeEntity(createBoulder(registry, cx + 2, cy));
  level.placeEntity(createDoor(registry, 5, 3));
  level.placeEntity(createPotion(registry, cx - 2, cy));
}
