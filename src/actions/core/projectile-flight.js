/**
 * @file Shared straight-line projectile flight: tracing a thrown/fired item's path to its impact tile
 * and settling it afterward (break, land, or bounce back). Extracted from action-throw.js so throwing
 * and ranged attacks resolve flight identically — "same LOS and breaking mechanics" by construction
 * rather than parallel maintenance. See docs/design/ranged-weapons.md and docs/howto/item.md.
 */
import { rng } from '../../engine/core/rng.js';
import { components } from '../../world/entities/components.js';
import { getTileType } from '../../world/map/tile-registry.js';
import { lineTiles } from '../../world/map/geometry.js';

/**
 * True if a tile stops a projectile's flight: solid terrain (a wall) or any entity that blocks
 * movement — a fixture (boulder, chest, closed door) or a creature, all of which it slams into.
 */
export function stopsFlight(level, x, y) {
  const tileId = level.getTile(x, y);
  if (!tileId || getTileType(tileId).blocksMovement) return true;
  for (const e of level.getEntitiesAt(x, y)) {
    if (e.components.has('blocksMovement')) return true;
  }
  return false;
}

/**
 * True if a dropped item can come to rest on a tile (and be retrieved later). Solid terrain and solid
 * fixtures fill the tile and reject it; a creature does not — the item lands at its feet, recoverable
 * once the creature moves or dies. This is `blocksMovement` minus the `creature` exception, derived
 * rather than tracked as its own component (see docs/howto/item.md).
 */
export function tileHoldsItem(level, x, y) {
  const tileId = level.getTile(x, y);
  if (!tileId || getTileType(tileId).blocksMovement) return false;
  for (const e of level.getEntitiesAt(x, y)) {
    if (e.components.has('blocksMovement') && !e.components.has('creature')) return false;
  }
  return true;
}

// Places a projectile that didn't break onto the map at the resting tile, so it can be retrieved
// (mirrors executeDrop's placement). The item must already have left its previous location.
function landItem(item, x, y, level, registry) {
  item.components.get('item').location = { type: 'map' };
  if (item.components.has('position')) {
    const p = item.components.get('position');
    p.x = x;
    p.y = y;
  } else {
    registry.addComponent(item, 'position', components.position(x, y));
  }
  level.placeEntity(item);
}

/**
 * Traces a projectile's straight-line flight from (ox, oy) toward (tx, ty). Returns the `impact` tile —
 * the first tile along the line that stops it (a wall, fixture, or creature), or the target if the line
 * is clear — and `before`, the last clear tile it passed (the fallback resting spot when the impact
 * tile can't hold it). `before` defaults to the origin tile, so a projectile launched straight into an
 * adjacent obstacle settles at the launcher's feet.
 */
export function traceFlight(level, ox, oy, tx, ty) {
  const path = lineTiles(ox, oy, tx, ty);
  let before = path[0]; // the origin tile
  for (let i = 1; i < path.length; i++) {
    const tile = path[i];
    if (stopsFlight(level, tile.x, tile.y)) return { impact: tile, before };
    before = tile;
  }
  return { impact: path[path.length - 1], before };
}

/**
 * Settles a projectile after its flight has resolved its on-impact effect. Rolls `breakChance` (0..1):
 * on a break it destroys the item and returns `true`; otherwise it lands the item on the impact tile if
 * that tile can hold it, else bounces it back to the last clear tile (`before`), and returns `false` —
 * so a projectile never strands inside a wall, boulder, or chest. Pass `breakChance: null` for a
 * projectile that cannot break (e.g. an ordinary item thrown without a `throwable` component); the roll
 * is then skipped entirely, leaving the RNG sequence untouched.
 * @returns {boolean} Whether the projectile broke.
 */
export function settleProjectile(item, { impact, before, breakChance }, level, registry) {
  const broke = breakChance != null && rng.random() < breakChance;
  if (broke) {
    registry.destroyEntity(item);
    return true;
  }
  const rest = tileHoldsItem(level, impact.x, impact.y) ? impact : before;
  landItem(item, rest.x, rest.y, level, registry);
  return false;
}
