/**
 * @file Realization stage: turns a BSP plan (`bspGeometry`) into tiles. Paints each room's shared wall
 * ring, floors its interior, then cuts the planned exits and drops doors on them per the door params.
 * The result is a "fully packed" layout — every tile a room floor or a wall. Pairs with `bspGeometry`;
 * see that file and docs/design/map-generation.md.
 *
 * Owns the level's tile grid when none exists yet (standalone): sizes it to the plan's bounds and fills
 * wall. When `level.tiles` is already populated it works in place (embedded) — another stage may have
 * built an enclosing box for BSP to fill. `outerWall: false` (from the plan) then leaves the tiles on
 * the bounds border untouched, so the enclosing box's own wall stands.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   doors.present — 'all' | 'half' | 'none': which room exits get a door (default 'all').
 *   doors.open    — 'all' | 'half' | 'none': which of those doors spawn already open (default 'none').
 *                   'half' selects a seeded random half; the split is deterministic for a given seed.
 */
import { createDoor } from '../../entities/furniture.js';
import { LEVEL_ZONES, LEVEL_ROOMS, LEVEL_BSP } from '../blackboard-keys.js';

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The 'all' / 'half' / 'none' selector shared by the door present/open params. 'half' floors to an
// exact count off a seeded shuffle, so a given seed always doors/opens the same exits.
function selectFraction(items, mode, rng) {
  if (mode === 'none') return [];
  if (mode === 'half') return shuffle(items, rng).slice(0, Math.floor(items.length / 2));
  return items.slice(); // 'all' (default)
}

/** Runs the BSP carve realization stage (see the file overview for params). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const plan = blackboard[LEVEL_BSP];
  if (!plan) return;
  const { bounds, outerWall = true, exits = [] } = plan;
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const present = stageConfig.doors?.present ?? 'all';
  const open = stageConfig.doors?.open ?? 'none';

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

  // Wall ring per room. Shared seams get painted twice (once by each neighbour) — same result.
  // With outerWall off, tiles on the bounds border are left as the enclosing box laid them.
  for (const zone of zones) {
    const { x, y, w, h } = zone.rect;
    for (let tx = x; tx < x + w; tx++) {
      for (const ty of [y, y + h - 1]) if (outerWall || !onBorder(tx, ty)) setTile(tx, ty, 'wall');
    }
    for (let ty = y; ty < y + h; ty++) {
      for (const tx of [x, x + w - 1]) if (outerWall || !onBorder(tx, ty)) setTile(tx, ty, 'wall');
    }
  }

  // Floor each room's interior.
  for (const zone of zones) {
    const room = rooms[`${zone.id},0`];
    if (!room) continue;
    for (let ty = room.y0; ty <= room.y1; ty++) {
      for (let tx = room.x0; tx <= room.x1; tx++) setTile(tx, ty, 'floor');
    }
  }

  // Cut the exits (a single floor tile through the shared wall) and door them per the params.
  for (const exit of exits) setTile(exit.gap[0], exit.gap[1], 'floor');
  const doored = new Set(selectFraction(exits, present, rng));
  const opened = new Set(selectFraction([...doored], open, rng));
  for (const exit of doored) {
    level.placeEntity(createDoor(registry, exit.gap[0], exit.gap[1], { open: opened.has(exit) }));
  }
}
