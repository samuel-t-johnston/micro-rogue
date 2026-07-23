/**
 * @file Realization stage: turns a BSP plan (`bspGeometry`) into tiles. Walls the managed area, floors
 * each room interior and hall, then carves the planned connections and drops doors on the door-eligible
 * ones per the door params. The result is a "fully packed" layout — every tile a room floor or a wall
 * (plus hall corridors in hall mode). Pairs with `bspGeometry`; see that file and
 * docs/design/map-generation.md.
 *
 * Owns the level's tile grid when none exists yet (standalone): sizes it to the plan's bounds. When
 * `level.tiles` is already populated it works in place (embedded) — another stage may have built an
 * enclosing box for BSP to fill. `outerWall: false` (from the plan) then leaves the tiles on the bounds
 * border untouched, so the enclosing box's own wall stands.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   doors.present — 'all' | 'half' | 'none': which room exits get a door (default 'all').
 *   doors.open    — 'all' | 'half' | 'none': which of those doors spawn already open (default 'none').
 *                   'half' selects a seeded random half; the split is deterministic for a given seed.
 * Hall-to-hall connections are never doored (only door-eligible connections are considered).
 */
import { createDoor } from '../../entities/furniture.js';
import { LEVEL_ROOMS, LEVEL_BSP } from '../blackboard-keys.js';

export const DEFAULTS = { doors: { present: 'all', open: 'none' } };

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The 'all' / 'half' / 'none' selector shared by the door present/open params. 'half' floors to an
// exact count off a seeded shuffle, so a given seed always doors/opens the same connections.
function selectFraction(items, mode, rng) {
  if (mode === 'none') return [];
  if (mode === 'half') return shuffle(items, rng).slice(0, Math.floor(items.length / 2));
  return items.slice(); // 'all' (default)
}

/** Runs the BSP carve realization stage (see the file overview for params). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const plan = blackboard[LEVEL_BSP];
  if (!plan) return;
  const { bounds, outerWall = true, halls = [], connections = [] } = plan;
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const present = stageConfig.doors?.present ?? DEFAULTS.doors.present;
  const open = stageConfig.doors?.open ?? DEFAULTS.doors.open;

  // Own the grid only if no earlier stage laid tiles; otherwise carve into the existing level in place.
  if (!level.tiles.length) {
    level.width = bounds.x + bounds.w;
    level.height = bounds.y + bounds.h;
    level.tiles = Array.from({ length: level.height }, () =>
      Array.from({ length: level.width }, () => 'wall'),
    );
  }

  const onBorder = (x, y) =>
    x === bounds.x ||
    x === bounds.x + bounds.w - 1 ||
    y === bounds.y ||
    y === bounds.y + bounds.h - 1;
  const setTile = (x, y, type) => {
    if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = type;
  };
  const floorRect = (r) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) setTile(x, y, 'floor');
  };

  // Wall the whole managed area first (so an embedded empty box gets its interior walls), respecting
  // outerWall on the border, then floor everything walkable over it.
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      if (outerWall || !onBorder(x, y)) setTile(x, y, 'wall');
    }
  }
  for (const room of Object.values(rooms)) floorRect(room);
  for (const hall of halls) floorRect(hall);
  for (const c of connections) for (const [x, y] of c.tiles) setTile(x, y, 'floor');

  // Doors go on the door-eligible connections (room exits), never on hall-to-hall gaps.
  const eligible = connections.filter((c) => c.door);
  const doored = new Set(selectFraction(eligible, present, rng));
  const opened = new Set(selectFraction([...doored], open, rng));
  for (const c of doored) {
    level.placeEntity(createDoor(registry, c.gap[0], c.gap[1], { open: opened.has(c) }));
  }
}
