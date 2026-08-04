/**
 * @file Post-carve stage: converts existing closed doors into secret doors — walls disguised as the
 * terrain beneath them until a search reveals them (see docs/design/secret-doors-and-search.md). Runs
 * as its own stage AFTER all carving and door placement, so no later carve can re-floor a secret's
 * tile; that makes it work for every pipeline regardless of how the doors were placed, and keeps the
 * carve stages ignorant of secrets. Run it BEFORE `lineWalls` so a re-walled tile joins the
 * box-drawing mask with its neighbours.
 *
 * Stage parameters (all optional):
 *   chance — probability (0..1) an eligible door becomes secret (default 0 — the stage is then a no-op).
 *   scope  — 'redundant' (default): hide only doors on a loop, so a non-secret path always remains and
 *            the player is never forced to search. 'all': may hide a sole-access door, gating a region
 *            behind a search (the region stays reachable — a secret is a latent passage).
 *   bounds — {x,y,w,h}: only convert doors inside this sub-rect, e.g. one district of a composite level
 *            (default the whole level). Redundancy is still judged over the whole map, so an alternate
 *            route through another district counts.
 *
 * Redundancy is structural, judged against the current NON-secret graph: a door is redundant iff, with
 * it (and any already-converted secrets) treated as wall, its two floor sides are still connected
 * through other floor. Because conversions mutate the tiles as we go and we visit doors in a fixed
 * order, 'redundant' scope can never disconnect the non-secret map — every region keeps a searchless
 * path. Deterministic: the rng is drawn only for a door the scope actually admits, so chance 0 draws
 * nothing and leaves seeded output byte-identical.
 *
 * Blackboard: reads the palette (wall fallback only); rewrites tiles; removes door entities and places
 * secretDoor entities.
 */
import { createSecretDoor } from '../../entities/furniture.js';
import { paletteOf } from '../palette.js';
import { tileCategory, isFloorTile } from '../../map/tile-registry.js';
import { DIRECTIONS_4 } from '../../map/geometry.js';

export const DEFAULTS = { chance: 0, scope: 'redundant' };

/**
 * Whether a door the scope admits should flip to secret. Draws the rng ONLY when admitted, so an
 * un-admitted door (a sole-access door under 'redundant' scope) neither converts nor perturbs the
 * stream. Exported for unit testing.
 */
export function wantSecret(redundant, scope, chance, rng) {
  if (scope === 'redundant' && !redundant) return false;
  return rng.random() < chance;
}

// The id of an orthogonally-adjacent wall tile (so a converted secret inherits the LOCAL district wall
// — stone vs cave — rather than a possibly-mismatched palette), or null if none is adjacent.
function wallNeighborId(level, x, y) {
  for (const [dx, dy] of DIRECTIONS_4) {
    const id = level.tiles[y + dy]?.[x + dx];
    if (id != null && tileCategory(id) === 'wall') return id;
  }
  return null;
}

/** Runs the secret-doors stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const chance = stageConfig.chance ?? DEFAULTS.chance;
  if (chance <= 0) return; // no-op: never touch tiles or the rng
  const scope = stageConfig.scope ?? DEFAULTS.scope;
  const bounds = stageConfig.bounds ?? { x: 0, y: 0, w: level.width, h: level.height };
  const paletteWall = paletteOf(blackboard).wall;

  const W = level.width;
  const inBounds = (x, y) =>
    x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;

  // Candidate doors: closed, positioned, inside bounds — visited in (y, x) order so conversions (and
  // thus rng draws) are deterministic.
  const doors = level.entities
    .filter((e) => {
      const openable = e.components.get('openable');
      const pos = e.components.get('position');
      return openable && !openable.isOpen && pos && inBounds(pos.x, pos.y);
    })
    .sort((a, b) => {
      const pa = a.components.get('position');
      const pb = b.components.get('position');
      return pa.y - pb.y || pa.x - pb.x;
    });

  // BFS over floor tiles (excluding one tile) — true if `to` is reachable from `from`. Already-converted
  // secrets are wall terrain by the time this runs, so they're excluded automatically.
  const reaches = (from, to, exceptKey) => {
    const seen = new Set([from[1] * W + from[0]]);
    const stack = [from];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x === to[0] && y === to[1]) return true;
      for (const [dx, dy] of DIRECTIONS_4) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * W + nx;
        if (seen.has(k) || k === exceptKey) continue;
        if (isFloorTile(level.tiles[ny]?.[nx])) {
          seen.add(k);
          stack.push([nx, ny]);
        }
      }
    }
    return false;
  };

  for (const door of doors) {
    const { x, y } = door.components.get('position');
    // The passage runs between the door's floor neighbours (two, opposite, for a door in a wall).
    const floorSides = DIRECTIONS_4.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) =>
      isFloorTile(level.tiles[ny]?.[nx]),
    );
    // 'all' converts regardless, so skip the flood there; else a door is redundant iff its two sides
    // still connect with it walled.
    const redundant =
      scope !== 'all' && floorSides.length >= 2 && reaches(floorSides[0], floorSides[1], y * W + x);
    if (!wantSecret(redundant, scope, chance, rng)) continue;

    const revealFloor = level.tiles[y][x]; // the floor the door sat on — what reveal restores
    const wall = wallNeighborId(level, x, y) ?? paletteWall;
    level.removeEntity(door);
    registry.destroyEntity(door);
    level.tiles[y][x] = wall;
    level.placeEntity(createSecretDoor(registry, x, y, { revealFloor }));
  }
}
