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
import { carveWalk } from '../walk.js';

export const DEFAULTS = { sobriety: 0.65, momentum: 0.5, maxStepsFactor: 4 };

/** Runs the carve-corridors realization stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const nodes = blackboard[LEVEL_NODES] ?? [];
  const edges = blackboard[LEVEL_EDGES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const opts = {
    sobriety: stageConfig.sobriety ?? DEFAULTS.sobriety,
    momentum: stageConfig.momentum ?? DEFAULTS.momentum,
    maxStepsFactor: stageConfig.maxStepsFactor ?? DEFAULTS.maxStepsFactor,
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    // Arrival = entering B's chamber floor, so the two chambers end up joined.
    const targetTiles = new Set((rooms[`${b.id},0`]?.tiles ?? []).map(([x, y]) => `${x},${y}`));
    carveWalk(level, a, b, targetTiles, opts, rng);
  }

  const norm = edges.map((e) => (e.a < e.b ? [e.a, e.b] : [e.b, e.a]));
  blackboard[LEVEL_ADJACENCY] = norm;
  blackboard[LEVEL_LINKS] = norm.map(([a, b], id) => ({ id, a, b }));
}
