/**
 * @file Post-carve stage: tries to tuck a tiny secret treasure room into solid rock, entered only
 * through a secret door. The minimal room is a single floor tile holding a chest, carved from a 3×3
 * footprint: a 1×3 run of existing wall (whose middle tile becomes the secret door, opening onto
 * adjacent floor) backed by a 2×3 block of untouched rock that becomes the room floor + its wall shell.
 *
 *     . # ~ ~          . # # #
 *     . # ~ ~    -->   . + = #      (. floor, # wall, ~ rock, + secret door, = chest)
 *     . # ~ ~          . # # #
 *
 * Four orientations (door faces N/E/S/W). "Rock" means an in-bounds wall tile — the stage never expands
 * the map or carves into existing floor, so the room stays sealed except through the secret door until a
 * search reveals it. If no orientation fits anywhere, no room is placed (no error). Run it after the
 * carve/door stages and before `lineWalls`. See docs/design/secret-doors-and-search.md §7 (Phase 3).
 *
 * Stage parameters (all optional):
 *   count    — how many rooms to try to place (default 1); placements never overlap.
 *   contents — chest loot as ENTITY_PREFABS item ids (default a healing potion + bread).
 *   bounds   — {x,y,w,h}: restrict the secret door's tile to this sub-rect (default whole level).
 *
 * Deterministic: candidates are found by a fixed scan, then chosen via the seeded rng.
 *
 * Blackboard: none. Rewrites one tile per room (rock → floor) and places a chest + a secretDoor entity.
 */
import { createSecretDoor } from '../../entities/furniture.js';
import { ENTITY_PREFABS } from '../../entities/entity-prefabs.js';
import { isFloorTile, tileCategory } from '../../map/tile-registry.js';
import { DIRECTIONS_4 } from '../../map/geometry.js';

export const DEFAULTS = { count: 1, contents: ['healingPotion', 'bread'] };

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Runs the secret-room stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const count = stageConfig.count ?? DEFAULTS.count;
  if (count <= 0) return;
  const contents = stageConfig.contents ?? DEFAULTS.contents;
  const bounds = stageConfig.bounds ?? { x: 0, y: 0, w: level.width, h: level.height };

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < level.width && y < level.height;
  const isWall = (x, y) => inBounds(x, y) && tileCategory(level.tiles[y][x]) === 'wall';
  const isFloor = (x, y) => isFloorTile(level.tiles[y]?.[x]);
  const key = (x, y) => `${x},${y}`;

  // A candidate is a door tile `d` opening outward `o` onto floor, backed by a 2×3 rock block. Its
  // `footprint` is the 3×3 of tiles the room owns, used to keep multiple rooms from overlapping.
  const candidates = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      if (!isWall(x, y)) continue; // the door tile is a wall (disguised) until revealed
      for (const [ox, oy] of DIRECTIONS_4) {
        if (!isFloor(x + ox, y + oy)) continue; // door must open onto existing floor
        const [sx, sy] = [-oy, ox]; // one perpendicular; the other is its negation
        // The 1×3 wall run flanking the door.
        if (!isWall(x + sx, y + sy) || !isWall(x - sx, y - sy)) continue;
        // The 2×3 rock block behind the door (inward = -o), across the door line (±s).
        const footprint = [key(x, y), key(x + sx, y + sy), key(x - sx, y - sy)];
        let fits = true;
        for (let step = 1; step <= 2 && fits; step++) {
          for (const side of [0, 1, -1]) {
            const bx = x - ox * step + sx * side;
            const by = y - oy * step + sy * side;
            if (!isWall(bx, by)) {
              fits = false;
              break;
            }
            footprint.push(key(bx, by));
          }
        }
        if (fits) {
          candidates.push({
            door: [x, y],
            floor: [x - ox, y - oy], // the room's single floor tile (inward of the door)
            floorId: level.tiles[y + oy][x + ox], // match the floor the door opens onto
            footprint: new Set(footprint),
          });
        }
      }
    }
  }

  const used = new Set();
  let placed = 0;
  for (const c of shuffle(candidates, rng)) {
    if (placed >= count) break;
    if ([...c.footprint].some((k) => used.has(k))) continue; // don't overlap an already-placed room

    const [fx, fy] = c.floor;
    level.tiles[fy][fx] = c.floorId; // carve the room floor out of the rock
    placeChest(level, registry, fx, fy, contents);
    level.placeEntity(createSecretDoor(registry, c.door[0], c.door[1], { revealFloor: c.floorId }));

    for (const k of c.footprint) used.add(k);
    placed += 1;
  }
}

// Builds a chest at (x, y) stocked with `contents` (item prefab ids), mirroring stage-place-static-
// entities' chest handling so authored and generated chests fill the same way.
function placeChest(level, registry, x, y, contents) {
  const chest = ENTITY_PREFABS.chest.make(registry, x, y);
  const inventory = chest.components.get('inventory');
  for (const itemType of contents) {
    const prefab = ENTITY_PREFABS[itemType];
    if (!prefab || prefab.kind !== 'item')
      throw new Error(`Unknown secret-room item type "${itemType}"`);
    inventory.items.push(prefab.make(registry, null, null, chest.id));
  }
  level.placeEntity(chest);
}
