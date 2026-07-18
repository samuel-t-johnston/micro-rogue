/**
 * @file Structure-planning stage: samples chamber sites for an organic (walker) level. Writes a plan
 * graph — points with radii, no tiles — that `layoutEdges` connects and `carveChambers`/`carveCorridors`
 * realize. First stage of the semi-sober walker pipeline; see docs/design/organic-map-generation.md.
 *
 * Sampling is dart-throwing with rejection: try up to `attempts` random positions per node, keeping the
 * first that clears `minSeparation` from every placed node. The count is therefore a target/ceiling —
 * a crowded map yields fewer than `nodeCount`. This sits behind the stage as an implementation detail
 * (the plan-graph seam), so a maximal Poisson-disk sampler or a hand-authored set can swap in later
 * without touching the carve stages.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   width, height  — sampling rect in tiles, walls included (default 48 × 32). Ignored if bounds.
 *   bounds         — {x,y,w,h}: sample within this sub-rectangle of a larger, in-progress level.
 *   nodeCount      — target chamber count / ceiling (default 12).
 *   radius         — [min, max] chamber radius in tiles, uniform (default [2, 6]).
 *   minSeparation  — minimum distance between node centres (default 2·maxRadius + 2, which keeps
 *                    chambers distinct; drop below it deliberately for lobed caverns).
 *   attempts       — dart-throw budget per node before giving up on it (default 30).
 *
 * Blackboard output:
 *   level:nodes -> [{ id, x, y, radius }]
 */
import { LEVEL_NODES } from '../blackboard-keys.js';

const DEFAULTS = { width: 48, height: 32, nodeCount: 12, radius: [2, 6], attempts: 30 };

// Radius is drawn uniformly over [min, max] for now. Note chamber *area* grows as radius², so uniform
// radius already weights floor coverage toward the larger chambers; a deliberate low-skew (few large,
// many small) may read as a more cave-like size hierarchy — revisit once the first floor is renderable
// and we can judge it visually.

/** Runs the layout-nodes planning stage (see the file overview for params and outputs). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const bounds = stageConfig.bounds ?? {
    x: 0,
    y: 0,
    w: stageConfig.width ?? DEFAULTS.width,
    h: stageConfig.height ?? DEFAULTS.height,
  };
  const nodeCount = stageConfig.nodeCount ?? DEFAULTS.nodeCount;
  const [minR, maxR] = stageConfig.radius ?? DEFAULTS.radius;
  const minSep = stageConfig.minSeparation ?? 2 * maxR + 2;
  const attempts = stageConfig.attempts ?? DEFAULTS.attempts;
  const minSepSq = minSep * minSep;

  // Keep a whole chamber (centre ± maxRadius) inside the bounds' wall ring: one tile of margin plus
  // the largest radius any chamber might take.
  const pad = maxR + 1;
  const xLo = bounds.x + pad;
  const xHi = bounds.x + bounds.w - 1 - pad;
  const yLo = bounds.y + pad;
  const yHi = bounds.y + bounds.h - 1 - pad;

  const nodes = [];
  if (xLo <= xHi && yLo <= yHi) {
    for (let i = 0; i < nodeCount; i++) {
      for (let a = 0; a < attempts; a++) {
        const x = rng.intInclusive(xLo, xHi);
        const y = rng.intInclusive(yLo, yHi);
        if (nodes.every((n) => (n.x - x) ** 2 + (n.y - y) ** 2 >= minSepSq)) {
          nodes.push({ id: nodes.length, x, y, radius: rng.intInclusive(minR, maxR) });
          break;
        }
      }
    }
  }

  blackboard[LEVEL_NODES] = nodes;
}
