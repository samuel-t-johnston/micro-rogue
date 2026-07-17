/**
 * @file Population stage: places items and creatures by room label. Treasure rooms get a chest plus a
 * few floor items; item rooms get floor items; creatures pick rooms by affinity weights (a room's
 * weight is the product of its labels' weights — >1 attracts, <1 repels). See docs/design/procedural-3x3-dungeon.md.
 */
import { ENTITY_PREFABS, prefabIdsByKind } from '../../entities/entity-prefabs.js';
import { roomTiles, centermostRoomTile } from '../zone-tiles.js';
import { LEVEL_ZONES, LEVEL_ROOMS } from '../blackboard-keys.js';

const make = (registry, id, x, y, entityId) => ENTITY_PREFABS[id].make(registry, x, y, entityId);

// Random floor/chest item pool: every item prefab except the Amulet, which is the win objective and
// placed deterministically on the 'amulet' zone below — never rolled in.
const ITEM_POOL = prefabIdsByKind('item').filter((id) => id !== 'amulet');

// Spawn rules (overridable via stageConfig). The creature `weights` are per-label multipliers; a
// room's pick-weight is the product over its labels (absent labels contribute 1). The creature roster
// is content and lives in the pipeline config (see data/pipelines/procedural-3x3.js) — empty here, so
// a populate stage with no roster places items only. Item-count defaults stay as tuning knobs, exported
// so tests can assert against them.
//
// `items.weights` biases *which* item type each floor/chest roll produces: it maps an item prefab id
// to a multiplier (any id absent from the map, and every id when weights is empty, counts as 1). So
// `{ bread: 8 }` makes bread eight times likelier than each other item. This is how a pipeline stocks a
// theme — e.g. the BSP branch floor weights the three foods heavily for a food-rich level (see
// data/pipelines/bsp.js). Empty weights (the default) reduce exactly to a uniform pick, so pipelines
// that don't set weights keep their existing seeded output unchanged. Item *type* selection (weights)
// is separate from item *count* (treasureRoom/itemRoom above) and from *where* items land (room labels).
export const DEFAULTS = {
  treasureRoom: { chestItems: [1, 2], floorItems: [0, 1] },
  itemRoom: { floorItems: [1, 1] },
  creatures: [],
  items: { weights: {} },
};

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

// Weighted item-type pick over the pool (weight = weights[id] ?? 1). With no weights this reduces
// exactly to rng.pick, so pipelines that don't set weights keep their existing seeded output.
function weightedItem(pool, weights, rng) {
  const ws = pool.map((id) => weights[id] ?? 1);
  const total = ws.reduce((a, b) => a + b, 0);
  let t = rng.random() * total;
  for (let i = 0; i < pool.length; i++) {
    t -= ws[i];
    if (t < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Runs the populate stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const cfg = { ...DEFAULTS, ...stageConfig };
  const itemWeights = cfg.items?.weights ?? {};
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};

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
    if (t) level.placeEntity(make(registry, weightedItem(ITEM_POOL, itemWeights, rng), t[0], t[1]));
  };

  // Treasure rooms: a chest (with items) + some floor items.
  for (const zone of zones.filter((z) => z.labels.includes('treasure'))) {
    const ct = freeTile(zone);
    if (ct) {
      const chest = make(registry, 'chest', ct[0], ct[1]);
      const inv = chest.components.get('inventory');
      const n = rng.intInclusive(...cfg.treasureRoom.chestItems);
      for (let i = 0; i < n; i++)
        inv.items.push(
          make(registry, weightedItem(ITEM_POOL, itemWeights, rng), null, null, chest.id),
        );
      level.placeEntity(chest);
    }
    const n = rng.intInclusive(...cfg.treasureRoom.floorItems);
    for (let i = 0; i < n; i++) dropItem(zone);
  }

  // Item rooms: floor items only.
  for (const zone of zones.filter((z) => z.labels.includes('item'))) {
    const n = rng.intInclusive(...cfg.itemRoom.floorItems);
    for (let i = 0; i < n; i++) dropItem(zone);
  }

  // Amulet of Yendor: the win objective. Placed on the centermost tile of the 'amulet' zone —
  // deterministic and guaranteed (unlike a random free tile that could come up empty), since the
  // game is unwinnable without it. Placed before creatures so it reserves its tile. Floors without
  // the 'amulet' label (every floor but the deepest) simply skip this.
  for (const zone of zones.filter((z) => z.labels.includes('amulet'))) {
    const t = centermostRoomTile(zone, rooms);
    if (t) level.placeEntity(make(registry, 'amulet', t[0], t[1]));
    else console.warn('[populate] amulet zone has no room; Amulet not placed');
  }

  // Creatures: weighted room choice; never on the player's arrival room (stairs-up), and only into
  // rooms that still have an open tile.
  const spawnRooms = zones.filter((z) => !z.labels.includes('stairs-up'));
  for (const spec of cfg.creatures) {
    const used = new Set();
    for (let i = 0; i < spec.count; i++) {
      const candidates = (
        spec.separate ? spawnRooms.filter((z) => !used.has(z.id)) : spawnRooms
      ).filter((z) => openTiles(z).length > 0);
      if (candidates.length === 0) break;
      const room = weightedPick(candidates, spec.weights ?? {}, rng);
      used.add(room.id);
      const t = freeTile(room);
      if (t) level.placeEntity(make(registry, spec.type, t[0], t[1]));
    }
  }
}
