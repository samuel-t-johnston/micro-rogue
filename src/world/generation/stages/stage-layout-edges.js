/**
 * @file Structure-planning stage: connects the chamber sites `layoutNodes` planned into a graph the
 * carve stages turn into corridors. Second stage of the semi-sober walker pipeline; writes only the
 * graph, no tiles. See docs/design/organic-map-generation.md.
 *
 * The graph is a Euclidean minimum spanning tree (the connective backbone — guarantees every chamber
 * is reachable) plus a few extra short edges tagged `loop` (trees play as dead ends). Loops are drawn
 * shortest-first and accepted only if they cross no already-accepted edge, so corridors stay short and
 * the plan stays roughly planar. This is brute force by design (O(n²)–O(n³) at a chamber count the map
 * physically caps around 30–40); Delaunay is deliberately not used — see ADR-028. The stage consumes
 * no RNG: it is a pure function of node geometry, tie-breaking by index.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   loopFactor — extra loop edges as a fraction of the tree size, i.e. round(loopFactor·(n−1))
 *                (default 0.2). 0 yields a pure tree.
 *
 * Blackboard:
 *   reads  level:nodes -> [{ id, x, y, radius }]
 *   writes level:edges -> [{ a, b, kind }]   (a < b; kind: 'mst' | 'loop')
 */
import { LEVEL_NODES, LEVEL_EDGES } from '../blackboard-keys.js';

const DEFAULTS = { loopFactor: 0.2 };

const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/**
 * True only if segments a–b and c–d *properly* cross (interiors intersect). A shared endpoint or a
 * collinear touch counts as non-crossing — two corridors meeting at a chamber is fine, and collinear
 * overlap is treated as safe rather than special-cased.
 */
export function segmentsCross(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

// Prim's dense O(n²) MST over node indices; returns [{a,b}] with a<b. Ties break by lowest index
// (the `< best` comparison keeps the first), so the tree is a deterministic function of geometry.
function mstEdges(nodes) {
  const n = nodes.length;
  const edges = [];
  if (n < 2) return edges;
  const inTree = new Array(n).fill(false);
  const dist = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  inTree[0] = true;
  for (let v = 1; v < n; v++) {
    dist[v] = sqDist(nodes[0], nodes[v]);
    parent[v] = 0;
  }
  for (let k = 1; k < n; k++) {
    let u = -1;
    let best = Infinity;
    for (let v = 0; v < n; v++)
      if (!inTree[v] && dist[v] < best) {
        best = dist[v];
        u = v;
      }
    if (u === -1) break;
    inTree[u] = true;
    edges.push({ a: Math.min(u, parent[u]), b: Math.max(u, parent[u]) });
    for (let v = 0; v < n; v++)
      if (!inTree[v]) {
        const d = sqDist(nodes[u], nodes[v]);
        if (d < dist[v]) {
          dist[v] = d;
          parent[v] = u;
        }
      }
  }
  return edges;
}

/** Runs the layout-edges planning stage (see the file overview for params and outputs). */
export function run(level, stageConfig = {}, blackboard) {
  const nodes = blackboard[LEVEL_NODES] ?? [];
  const loopFactor = stageConfig.loopFactor ?? DEFAULTS.loopFactor;

  const edges = mstEdges(nodes).map((e) => ({ a: e.a, b: e.b, kind: 'mst' }));
  const inGraph = new Set(edges.map((e) => `${e.a},${e.b}`));

  // Candidate loops: every non-tree pair, shortest first, ties by index (no RNG).
  const candidates = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      if (inGraph.has(`${i},${j}`)) continue;
      candidates.push({ a: i, b: j, d: sqDist(nodes[i], nodes[j]) });
    }
  candidates.sort((e1, e2) => e1.d - e2.d || e1.a - e2.a || e1.b - e2.b);

  const shares = (e, f) => e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b;
  const loopCount = Math.round(loopFactor * Math.max(0, nodes.length - 1));
  let added = 0;
  for (const cand of candidates) {
    if (added >= loopCount) break;
    // Edges meeting the candidate at a shared chamber don't count as crossings.
    const crosses = edges.some(
      (e) =>
        !shares(cand, e) && segmentsCross(nodes[cand.a], nodes[cand.b], nodes[e.a], nodes[e.b]),
    );
    if (crosses) continue;
    edges.push({ a: cand.a, b: cand.b, kind: 'loop' });
    added++;
  }

  blackboard[LEVEL_EDGES] = edges;
}
