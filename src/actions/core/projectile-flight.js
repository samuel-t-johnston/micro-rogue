/**
 * @file Shared straight-line projectile flight: tracing a thrown/fired item's path to its impact tile
 * and settling it afterward (break, land, or bounce back). Extracted from action-throw.js so throwing
 * and ranged attacks resolve flight identically — "same LOS and breaking mechanics" by construction
 * rather than parallel maintenance. See docs/design/ranged-weapons.md and docs/howto/item.md.
 */
import { rng } from '../../engine/core/rng.js';
import { placeItemOnMap } from '../../world/entities/placement.js';
import { getTileType } from '../../world/map/tile-registry.js';
import {
  lineTiles,
  cardinalDirection,
  COMPASS_DIRECTIONS,
  DIRECTION_STEPS,
} from '../../world/map/geometry.js';

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

/**
 * Where a *missed* shot at `target` is redirected: a random tile adjacent to the target, drawn from the
 * five that are not "behind" it from the shooter's viewpoint. The excluded three — the tile in the
 * shot's travel direction plus its two diagonal neighbours — are the ones whose line from the shooter
 * runs through the target itself, so dropping them keeps a miss from punching *through* the target to
 * reach its scatter tile. Candidates are filtered by `tileHoldsItem`, which admits open floor and
 * creature tiles but rejects walls and solid fixtures — so a stray shot can still clip a bystander
 * standing beside the target (the fun part) but never "scatters into" a wall. Returns `null` when the
 * target is boxed in (all five blocked) or the shooter and target coincide; the caller then just hits.
 */
export function scatterTile(level, from, target) {
  const dir = cardinalDirection(from, target);
  if (!dir) return null;
  const i = COMPASS_DIRECTIONS.indexOf(dir);
  const behind = new Set([
    COMPASS_DIRECTIONS[i],
    COMPASS_DIRECTIONS[(i + 1) % 8],
    COMPASS_DIRECTIONS[(i + 7) % 8],
  ]);
  const candidates = COMPASS_DIRECTIONS.filter((d) => !behind.has(d))
    .map((d) => ({ x: target.x + DIRECTION_STEPS[d][0], y: target.y + DIRECTION_STEPS[d][1] }))
    .filter((t) => tileHoldsItem(level, t.x, t.y));
  return candidates.length ? rng.pick(candidates) : null;
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
  placeItemOnMap(registry, level, item, rest.x, rest.y);
  return false;
}
