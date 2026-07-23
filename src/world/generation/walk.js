/**
 * @file The goal-biased "semi-sober" walker, shared by the stages that carve organic passages —
 * carveCorridors (chamber-to-chamber) and caBridge (CA component-to-component). Kept here so both use
 * the identical walk with the same load-bearing guarantees. See docs/design/organic-map-generation.md.
 */
import { DIRECTIONS_4, chebyshevDistance } from '../map/geometry.js';

const key = (x, y) => `${x},${y}`;

// A single step from `pos` toward `target`: move along the axis with the greater remaining distance,
// breaking a tie with the rng (so a diagonal approach doesn't always favour one axis).
function stepToward(pos, target, rng) {
  const dx = Math.sign(target.x - pos.x);
  const dy = Math.sign(target.y - pos.y);
  const adx = Math.abs(target.x - pos.x);
  const ady = Math.abs(target.y - pos.y);
  if (adx > ady) return [dx, 0];
  if (ady > adx) return [0, dy];
  if (dx === 0) return [0, dy];
  if (dy === 0) return [dx, 0];
  return rng.random() < 0.5 ? [dx, 0] : [0, dy];
}

/**
 * Carves a width-1 goal-biased walk from `start` to `target` (both `{x,y}`), returning nothing. Each
 * step heads toward the target with probability `sobriety`; otherwise it wanders — repeating its last
 * heading with probability `momentum`, else a random turn — which is where the organic look comes from.
 * Two guarantees make it robust: it stops as soon as it enters `targetTiles` (a Set of `"x,y"`, the
 * destination's own floor, so the two are joined), and if it hasn't arrived within
 * `maxStepsFactor · chebyshev(start,target)` steps it L-lines the remainder to `target`. That makes
 * non-arrival — a disconnected level, the one bug that ruins a run — impossible rather than unlikely.
 * The L fallback advances one axis per tile so the path stays 4-connected (a diagonal line would only
 * corner-touch and wouldn't be walkable). Consumes rng. Returns the tiles it *dug* (turned from
 * non-floor to floor) — the tunnel it created, as opposed to the existing floor it passed through;
 * callers that care about connective tissue (caBridge → passages) collect these.
 *
 * `opts.blocked(x, y)` (optional) marks tiles the walk may neither step onto nor carve — e.g. reserved
 * rects. Callers must not aim a walk *across* a blocked region: the walker routes around small ones but
 * can't path-find, and its straight-line fallback would leave a gap (two dead-end stubs). caBridge
 * therefore skips any bridge whose straight line crosses reserved rather than relying on this alone.
 */
export function carveWalk(level, start, target, targetTiles, opts, rng) {
  const { sobriety, momentum, maxStepsFactor, blocked = () => false } = opts;
  const canStep = (x, y) => level.tiles[y]?.[x] !== undefined && !blocked(x, y);

  // Buffer the path and commit atomically: the walk never *steps* onto a blocked tile, but its
  // straight-line fallback might have to — and carving as we go would leave a dead-end stub. So if the
  // fallback can't reach the target without crossing a blocked tile, we carve nothing and report no
  // connection (the caller — caBridge — lets `stitch` join those pieces instead). With no `blocked`
  // predicate the fallback never trips, so this is exactly the old always-connect behaviour.
  const path = [[start.x, start.y]];
  const maxSteps = Math.max(1, maxStepsFactor * chebyshevDistance(start, target));
  let px = start.x;
  let py = start.y;
  let last = null;
  let arrived = false;

  for (let i = 0; i < maxSteps; i++) {
    if (targetTiles.has(key(px, py))) {
      arrived = true;
      break;
    }
    let dir;
    if (rng.random() < sobriety) dir = stepToward({ x: px, y: py }, target, rng);
    else if (last && rng.random() < momentum) dir = last;
    else dir = rng.pick(DIRECTIONS_4);
    const nx = px + dir[0];
    const ny = py + dir[1];
    if (canStep(nx, ny)) {
      px = nx;
      py = ny;
      last = dir;
      path.push([px, py]);
    }
  }

  if (!arrived) {
    let cx = px;
    let cy = py;
    while (cx !== target.x || cy !== target.y) {
      if (cx !== target.x) cx += Math.sign(target.x - cx);
      else cy += Math.sign(target.y - cy);
      if (blocked(cx, cy)) return []; // can't finish around the obstacle → don't carve a stub
      path.push([cx, cy]);
    }
  }

  const dug = [];
  for (const [x, y] of path) {
    if (level.tiles[y]?.[x] === undefined) continue;
    if (level.tiles[y][x] !== 'floor') dug.push([x, y]);
    level.tiles[y][x] = 'floor';
  }
  return dug;
}
