/**
 * @file Population stage: places items and creatures by room label. Treasure rooms get a chest plus a
 * few floor items; item rooms get floor items; creatures pick rooms by affinity weights (a room's
 * weight is the product of its labels' weights — >1 attracts, <1 repels). See docs/design/procedural-3x3-dungeon.md.
 */
import { createChest } from '../../furniture.js';
import {
  createHealingPotion,
  createPotionOfPain,
  createDagger,
  createSword,
  createLeatherArmor,
  createScroll,
  createAmulet,
} from '../../items.js';
import { createGoblin, createOrc, createOrcCommander } from '../../creatures.js';
import { roomTiles, centermostRoomTile } from '../zone-tiles.js';

const ITEM_FACTORIES = {
  healingPotion: createHealingPotion,
  potionOfPain: createPotionOfPain,
  dagger: createDagger,
  sword: createSword,
  leatherArmor: createLeatherArmor,
  scroll: createScroll,
};
const ITEM_POOL = Object.keys(ITEM_FACTORIES);
const CREATURE_FACTORIES = {
  goblin: createGoblin,
  orc: createOrc,
  orcCommander: createOrcCommander,
};

// Spawn rules (overridable via stageConfig). Creature `weights` are per-label multipliers; a room's
// pick-weight is the product over its labels (absent labels contribute 1). Exported so tests can
// assert against the configured roster/counts instead of duplicating the magic numbers.
export const DEFAULTS = {
  treasureRoom: { chestItems: [1, 2], floorItems: [0, 1] },
  itemRoom: { floorItems: [1, 1] },
  creatures: [
    { type: 'orcCommander', count: 1, weights: { treasure: 5, item: 2 } }, // leads the orcs
    { type: 'orc', count: 2, weights: { treasure: 5, item: 2 } }, // affinity
    { type: 'goblin', count: 2, weights: { treasure: 0.2, item: 0.2 }, separate: true }, // aversion, distinct rooms
  ],
};

const randInt = ([min, max], rng) => min + rng.nextInt(0, max - min + 1);

function roomWeight(zone, weights) {
  let w = 1;
  for (const label of zone.labels) if (weights[label] != null) w *= weights[label];
  return w;
}

/** Weighted-random room pick; falls back to uniform if every weight is zero. */
export function weightedPick(rooms, weights, rng) {
  const ws = rooms.map((r) => roomWeight(r, weights));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return rng.pick(rooms);
  let t = rng.random() * total;
  for (let i = 0; i < rooms.length; i++) {
    t -= ws[i];
    if (t < 0) return rooms[i];
  }
  return rooms[rooms.length - 1];
}

/** Runs the populate stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const cfg = { ...DEFAULTS, ...stageConfig };
  const zones = blackboard['level:zones'] ?? [];
  const rooms = blackboard['level:rooms'] ?? {};

  // Empty room tiles only — inside the room rect, and not already occupied (the spatial index
  // tracks everything placed so far: stairs, doors, the entry point, earlier spawns). This keeps
  // spawns out of hallways and off furniture, and stops anything from stacking.
  const openTiles = (zone) =>
    roomTiles(zone, rooms).filter(([x, y]) => level.getEntitiesAt(x, y).size === 0);
  const freeTile = (zone) => {
    const tiles = openTiles(zone);
    return tiles.length ? tiles[rng.nextInt(0, tiles.length)] : null;
  };
  const dropItem = (zone) => {
    const t = freeTile(zone);
    if (t) level.placeEntity(ITEM_FACTORIES[rng.pick(ITEM_POOL)](registry, t[0], t[1]));
  };

  // Treasure rooms: a chest (with items) + some floor items.
  for (const zone of zones.filter((z) => z.labels.includes('treasure'))) {
    const ct = freeTile(zone);
    if (ct) {
      const chest = createChest(registry, ct[0], ct[1]);
      const inv = chest.components.get('inventory');
      const n = randInt(cfg.treasureRoom.chestItems, rng);
      for (let i = 0; i < n; i++)
        inv.items.push(ITEM_FACTORIES[rng.pick(ITEM_POOL)](registry, null, null, chest.id));
      level.placeEntity(chest);
    }
    const n = randInt(cfg.treasureRoom.floorItems, rng);
    for (let i = 0; i < n; i++) dropItem(zone);
  }

  // Item rooms: floor items only.
  for (const zone of zones.filter((z) => z.labels.includes('item'))) {
    const n = randInt(cfg.itemRoom.floorItems, rng);
    for (let i = 0; i < n; i++) dropItem(zone);
  }

  // Amulet of Yendor: the win objective. Placed on the centermost tile of the 'amulet' zone —
  // deterministic and guaranteed (unlike a random free tile that could come up empty), since the
  // game is unwinnable without it. Placed before creatures so it reserves its tile. Floors without
  // the 'amulet' label (every floor but the deepest) simply skip this.
  for (const zone of zones.filter((z) => z.labels.includes('amulet'))) {
    const t = centermostRoomTile(zone, rooms);
    if (t) level.placeEntity(createAmulet(registry, t[0], t[1]));
    else console.warn('[populate] amulet zone has no room; Amulet not placed');
  }

  // Creatures: weighted room choice; never on the player's arrival room (stairs-up), and only into
  // rooms that still have an open tile.
  const spawnRooms = zones.filter((z) => !z.labels.includes('stairs-up'));
  for (const spec of cfg.creatures) {
    const factory = CREATURE_FACTORIES[spec.type];
    const used = new Set();
    for (let i = 0; i < spec.count; i++) {
      const candidates = (
        spec.separate ? spawnRooms.filter((z) => !used.has(z.id)) : spawnRooms
      ).filter((z) => openTiles(z).length > 0);
      if (candidates.length === 0) break;
      const room = weightedPick(candidates, spec.weights ?? {}, rng);
      used.add(room.id);
      const t = freeTile(room);
      if (t) level.placeEntity(factory(registry, t[0], t[1]));
    }
  }
}
