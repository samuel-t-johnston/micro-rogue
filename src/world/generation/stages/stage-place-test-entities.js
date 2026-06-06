import { createBoulder, createChest, createDoor } from '../../furniture.js';
import { createDagger, createHealingPotion, createPotionOfPain } from '../../items.js';

// Temporary stage: places test furniture and items for development. Replace with a proper
// population stage (see roadmap M5) once map generation matures.
export async function run(level, _stageConfig, _blackboard, _rng, registry) {
  const cx = Math.floor(level.width / 2);
  const cy = Math.floor(level.height / 2);

  level.placeEntity(createBoulder(registry, cx + 2, cy));
  level.placeEntity(createDoor(registry, 5, 3));
  level.placeEntity(createHealingPotion(registry, cx - 2, cy));
  level.placeEntity(createPotionOfPain(registry, cx - 2, cy + 1));
  level.placeEntity(createHealingPotion(registry, cx - 2, cy + 1));
  level.placeEntity(createDagger(registry, cx - 3, cy));

  const chest = createChest(registry, cx + 3, cy + 1);
  const inventory = chest.components.get('inventory');
  inventory.items.push(createHealingPotion(registry, null, null, chest.id));
  inventory.items.push(createPotionOfPain(registry, null, null, chest.id));
  inventory.items.push(createDagger(registry, null, null, chest.id));
  level.placeEntity(chest);
}
