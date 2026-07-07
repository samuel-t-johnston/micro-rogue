import { createGoblin, createOrc, createOrcCommander, createScuttler } from './creatures.js';
import {
  createHealingPotion,
  createPotionOfPain,
  createDagger,
  createSword,
  createSpear,
  createJavelin,
  createBow,
  createArrow,
  createLeatherArmor,
  createScroll,
  createAmulet,
  createGrapes,
  createBread,
  createMeat,
} from './items.js';
import {
  createStairs,
  createDungeonExit,
  createChest,
  createBoulder,
  createDoor,
} from './furniture.js';

/**
 * @file The single registry of spawnable entity types ("prefabs"). Each entry is keyed by the stable
 * id used in authored map data (data/maps/*.js) and by generation stages, and pairs a `kind`
 * (creature | item | furniture, for filtering spawn pools) with `make(registry, x, y, entityId)`,
 * which builds one instance. Items honor `entityId` to land inside a container; other kinds ignore it.
 *
 * This is THE source of truth for "what content exists": the placement stages, the procedural
 * populate stage, and the sprite/glyph coverage test all read it, so a new type is one line here plus
 * its factory. `entity-prefabs.test.js` fails if a `create*` factory is added without a prefab.
 *
 * Prefabs are pure content identity; placement concerns (e.g. tagging the arrival tile with
 * `entryPoint`) stay in the stages that place them. The player is intentionally absent — it is not
 * map-spawnable and is built directly via createPlayer (see player.js).
 */
export const ENTITY_PREFABS = {
  // Creatures
  goblin: { kind: 'creature', make: createGoblin },
  orc: { kind: 'creature', make: createOrc },
  orcCommander: { kind: 'creature', make: createOrcCommander },
  scuttler: { kind: 'creature', make: createScuttler },

  // Items (order here is the procedural item pool order — keep it stable for seeded-RNG determinism)
  healingPotion: { kind: 'item', make: createHealingPotion },
  potionOfPain: { kind: 'item', make: createPotionOfPain },
  dagger: { kind: 'item', make: createDagger },
  sword: { kind: 'item', make: createSword },
  leatherArmor: { kind: 'item', make: createLeatherArmor },
  scroll: { kind: 'item', make: createScroll },
  amulet: { kind: 'item', make: createAmulet },
  // Ranged-weapon set, appended to keep the existing procedural-pool order (and thus seeded
  // determinism) stable. See docs/design/ranged-weapons.md.
  spear: { kind: 'item', make: createSpear },
  javelin: { kind: 'item', make: createJavelin },
  bow: { kind: 'item', make: createBow },
  arrow: { kind: 'item', make: createArrow },
  // Consumable food (satiate effect). Appended last to keep the procedural item-pool order — and thus
  // seeded-RNG determinism — stable. See docs/design/attribute-system.md (hunger).
  grapes: { kind: 'item', make: createGrapes },
  bread: { kind: 'item', make: createBread },
  meat: { kind: 'item', make: createMeat },

  // Furniture. Stairs are two prefabs from one factory because the up/down variants render
  // differently and the map data refers to them by distinct ids.
  boulder: { kind: 'furniture', make: createBoulder },
  door: { kind: 'furniture', make: createDoor },
  chest: { kind: 'furniture', make: createChest },
  stairsUp: { kind: 'furniture', make: (registry, x, y) => createStairs(registry, x, y, 'up') },
  stairsDown: { kind: 'furniture', make: (registry, x, y) => createStairs(registry, x, y, 'down') },
  dungeonExit: { kind: 'furniture', make: createDungeonExit },
};

/** Ids of every prefab of a given kind, in declaration order. */
export const prefabIdsByKind = (kind) =>
  Object.keys(ENTITY_PREFABS).filter((id) => ENTITY_PREFABS[id].kind === kind);
