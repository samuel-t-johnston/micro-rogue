/**
 * @file Realization stage: carves a corridor for each planned edge (`layoutEdges`), joining the
 * chambers `carveChambers` laid down. Fourth and last structure stage of the semi-sober walker
 * pipeline. See docs/design/organic-map-generation.md.
 *
 * Each corridor is one goal-biased walk from node A's centre to node B's centre. At each step, with
 * probability `sobriety` the walker steps toward the target; otherwise it wanders (repeating its last
 * heading with probability `momentum`, else a random turn) — that deviation is where the organic look
 * comes from. The walk is width 1. Two guards make it robust:
 *   - it stops as soon as it enters the target chamber's tiles (the corridor already overlaps that
 *     floor, so the two chambers are joined);
 *   - if it hasn't arrived within `maxStepsFactor × chebyshev(A,B)` steps, it Bresenham-lines the
 *     remainder to the centre. This makes non-arrival *impossible* — a disconnected level is the one
 *     bug that ruins a run — rather than merely unlikely.
 *
 * Corridors are plain floor tiles: they create no zones (like BSP halls), so population never targets
 * them. The realized connections are still published to level:links / level:adjacency so the graph the
 * visualizer draws matches the plan.
 *
 * Stage parameters (all optional):
 *   sobriety       — P(step toward target) per step (default 0.65).
 *   momentum       — on a wander step, P(repeat last heading) (default 0.5).
 *   maxStepsFactor — step budget as a multiple of chebyshev(A,B) before the Bresenham fallback
 *                    (default 4).
 *
 * Blackboard:
 *   reads  level:nodes, level:edges, level:rooms
 *   writes tiles; level:links -> [{ id, a, b }], level:adjacency -> [[a,b], …]
 */
import {
  LEVEL_NODES,
  LEVEL_EDGES,
  LEVEL_ROOMS,
  LEVEL_LINKS,
  LEVEL_ADJACENCY,
} from '../blackboard-keys.js';
import { DIRECTIONS_4, chebyshevDistance } from '../../map/geometry.js';

const DEFAULTS = { sobriety: 0.65, momentum: 0.5, maxStepsFactor: 4 };

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

/** Runs the carve-corridors realization stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const nodes = blackboard[LEVEL_NODES] ?? [];
  const edges = blackboard[LEVEL_EDGES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const sobriety = stageConfig.sobriety ?? DEFAULTS.sobriety;
  const momentum = stageConfig.momentum ?? DEFAULTS.momentum;
  const maxStepsFactor = stageConfig.maxStepsFactor ?? DEFAULTS.maxStepsFactor;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const carve = (x, y) => {
    if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = 'floor';
  };
  const inBounds = (x, y) => level.tiles[y]?.[x] !== undefined;

  for (const edge of edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;

    const targetTiles = new Set((rooms[`${b.id},0`]?.tiles ?? []).map(([x, y]) => key(x, y)));
    const maxSteps = Math.max(1, maxStepsFactor * chebyshevDistance(a, b));
    let px = a.x;
    let py = a.y;
    let last = null;
    let arrived = false;
    carve(px, py);

    for (let i = 0; i < maxSteps; i++) {
      if (targetTiles.has(key(px, py))) {
        arrived = true;
        break;
      }
      let dir;
      if (rng.random() < sobriety) dir = stepToward({ x: px, y: py }, b, rng);
      else if (last && rng.random() < momentum) dir = last;
      else dir = rng.pick(DIRECTIONS_4);
      const nx = px + dir[0];
      const ny = py + dir[1];
      if (inBounds(nx, ny)) {
        px = nx;
        py = ny;
        last = dir;
        carve(px, py);
      }
    }

    // Fallback: an L to the target centre so the chambers are always joined. One axis per tile keeps
    // the path 4-connected (a diagonal line would only corner-touch and wouldn't be walkable).
    if (!arrived) {
      let cx = px;
      let cy = py;
      while (cx !== b.x || cy !== b.y) {
        if (cx !== b.x) cx += Math.sign(b.x - cx);
        else cy += Math.sign(b.y - cy);
        carve(cx, cy);
      }
    }
  }

  const norm = edges.map((e) => (e.a < e.b ? [e.a, e.b] : [e.b, e.a]));
  blackboard[LEVEL_ADJACENCY] = norm;
  blackboard[LEVEL_LINKS] = norm.map(([a, b], id) => ({ id, a, b }));
}
