/**
 * @file Population stage for static layouts: instantiates the authored entities a static/randomStatic
 * stage stashed on the blackboard (`static:entities`). Each spec is `{ type, x, y }`; `chest` also
 * carries `contents` (item type names). Placement is exact and deterministic — no RNG. `stairsUp`
 * doubles as the player's entry point. See docs/howto/static-map-layouts.md.
 */
import { createStairs, createDungeonExit, createChest, createBoulder, createDoor } from '../../furniture.js';
import { createHealingPotion, createPotionOfPain, createDagger, createSword, createLeatherArmor, createScroll } from '../../items.js';
import { createGoblin, createOrc, createOrcCommander, createScuttler } from '../../creatures.js';
import { components } from '../../components.js';

const ITEM_FACTORIES = {
  healingPotion: createHealingPotion,
  potionOfPain: createPotionOfPain,
  dagger: createDagger,
  sword: createSword,
  leatherArmor: createLeatherArmor,
  scroll: createScroll,
};

const FACTORIES = {
  stairsUp: (registry, x, y) => {
    const stairs = createStairs(registry, x, y, 'up');
    registry.addComponent(stairs, 'entryPoint', components.entryPoint());
    return stairs;
  },
  stairsDown: (registry, x, y) => createStairs(registry, x, y, 'down'),
  // Like stairsUp, the exit doubles as the player's entry point: the player starts here (no Amulet,
  // so no win), descends, and must return to this tile carrying the Amulet to escape.
  dungeonExit: (registry, x, y) => {
    const exit = createDungeonExit(registry, x, y);
    registry.addComponent(exit, 'entryPoint', components.entryPoint());
    return exit;
  },
  boulder: createBoulder,
  door: createDoor,
  goblin: createGoblin,
  orc: createOrc,
  orcCommander: createOrcCommander,
  scuttler: createScuttler,
  ...ITEM_FACTORIES,
};

function placeChest(level, registry, spec) {
  const chest = createChest(registry, spec.x, spec.y);
  const inventory = chest.components.get('inventory');
  for (const itemType of spec.contents ?? []) {
    const make = ITEM_FACTORIES[itemType];
    if (!make) throw new Error(`Unknown chest item type "${itemType}"`);
    inventory.items.push(make(registry, null, null, chest.id));
  }
  level.placeEntity(chest);
}

/** Runs the place-static-entities population stage (see the file overview). */
export function run(level, stageConfig, blackboard, rng, registry) {
  for (const spec of blackboard['static:entities'] ?? []) {
    if (spec.type === 'chest') {
      placeChest(level, registry, spec);
      continue;
    }
    const make = FACTORIES[spec.type];
    if (!make) throw new Error(`Unknown static entity type "${spec.type}"`);
    level.placeEntity(make(registry, spec.x, spec.y));
  }
}
