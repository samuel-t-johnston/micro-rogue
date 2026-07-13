/**
 * @file Linking stage (geometry-agnostic): chooses which adjacent zones are actually connected.
 * Builds a random spanning tree over the adjacency graph — so the dungeon is one connected
 * whole by construction — then adds occasional extra links for loops, keeping most zones near a
 * soft degree target. Links are always a subset of adjacency, so halls stay local.
 * See docs/design/procedural-3x3-dungeon.md.
 *
 * Stage parameters (optional):
 *   extraLinkChance — probability of adding each eligible non-tree adjacency edge (default 0.2)
 *   maxExtraDegree  — only add an extra link if BOTH endpoints are below this degree (default 2).
 *                     The spanning tree may still push a junction past it — connectivity wins.
 *
 * Reads:  level:zones, level:adjacency
 * Writes: level:links -> [{ id, a, b }]   (a < b, ordered)
 */
import { LEVEL_ZONES, LEVEL_ADJACENCY, LEVEL_LINKS } from '../blackboard-keys.js';

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Runs the linking stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const extraLinkChance = stageConfig.extraLinkChance ?? 0.2;
  const maxExtraDegree = stageConfig.maxExtraDegree ?? 2;
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const adjacency = blackboard[LEVEL_ADJACENCY] ?? [];

  // Union-find over zone ids (path-halving; no rank — graphs are tiny).
  const parent = new Map(zones.map((z) => [z.id, z.id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };

  const edges = shuffle(adjacency, rng).map(([a, b]) => (a < b ? [a, b] : [b, a]));
  const degree = new Map(zones.map((z) => [z.id, 0]));
  const chosen = [];
  const leftover = [];

  const take = (a, b) => {
    chosen.push([a, b]);
    degree.set(a, degree.get(a) + 1);
    degree.set(b, degree.get(b) + 1);
  };

  // Spanning tree (randomized Kruskal): keep an edge only if it joins two components.
  for (const [a, b] of edges) {
    if (find(a) !== find(b)) {
      parent.set(find(a), find(b));
      take(a, b);
    } else {
      leftover.push([a, b]);
    }
  }

  // Extra links for loops, only where both endpoints are still under the soft cap.
  for (const [a, b] of leftover) {
    if (
      degree.get(a) < maxExtraDegree &&
      degree.get(b) < maxExtraDegree &&
      rng.random() < extraLinkChance
    ) {
      take(a, b);
    }
  }

  chosen.sort((e1, e2) => e1[0] - e2[0] || e1[1] - e2[1]);
  blackboard[LEVEL_LINKS] = chosen.map(([a, b], id) => ({ id, a, b }));
}
