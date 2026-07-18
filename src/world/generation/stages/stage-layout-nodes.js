/**
 * @file Structure-planning stage: samples chamber sites for an organic (walker) level. Writes a plan
 * graph — points with radii, no tiles — that `layoutEdges` connects and `carveChambers`/`carveCorridors`
 * realize. First stage of the semi-sober walker pipeline; see docs/design/organic-map-generation.md.
 *
 * Sampling is dart-throwing with rejection: try up to `attempts` random positions per node, keeping the
 * first whose chamber clears every placed chamber by at least `gap` wall tiles. Separation is checked
 * against each pair's *actual* radii (distance ≥ rA + rB + gap), not a single worst-case spacing — a
 * global minimum would reserve max-radius room for every pair and, since most chambers are small,
 * silently yield far fewer than `nodeCount` on a normal-sized map. The count is still a target/ceiling:
 * a crowded map yields fewer. This sits behind the stage as an implementation detail (the plan-graph
 * seam), so a maximal Poisson-disk sampler or a hand-authored set can swap in later without touching
 * the carve stages.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   width, height  — sampling rect in tiles, walls included (default 48 × 32). Ignored if bounds.
 *   bounds         — {x,y,w,h}: sample within this sub-rectangle of a larger, in-progress level.
 *   nodeCount      — target chamber count / ceiling (default 12).
 *   radius         — [min, max] chamber radius in tiles, uniform (default [2, 6]).
 *   gap            — minimum wall tiles between two chambers' edges (default 2). Drop toward 0 (or
 *                    negative) deliberately for touching / lobed caverns.
 *   attempts       — dart-throw budget per node before giving up on it (default 30).
 *
 * Blackboard outputs:
 *   level:nodes  -> [{ id, x, y, radius }]
 *   level:bounds -> { x, y, w, h }   (so the carve stages can size a standalone grid without the
 *                    map dimensions being restated on their own configs)
 */
import { LEVEL_NODES, LEVEL_BOUNDS } from '../blackboard-keys.js';

const DEFAULTS = { width: 48, height: 32, nodeCount: 12, radius: [2, 6], gap: 2, attempts: 30 };

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
  const gap = stageConfig.gap ?? DEFAULTS.gap;
  const attempts = stageConfig.attempts ?? DEFAULTS.attempts;

  // A chamber of drawn radius r stays inside the bounds' wall ring if its centre is ≥ r+1 from the
  // border. Small chambers can therefore sit nearer the edge than large ones, so pad per draw.
  const fits = (r) =>
    bounds.x + r + 1 <= bounds.x + bounds.w - 1 - (r + 1) &&
    bounds.y + r + 1 <= bounds.y + bounds.h - 1 - (r + 1);

  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let a = 0; a < attempts; a++) {
      const radius = rng.intInclusive(minR, maxR);
      if (!fits(radius)) continue;
      const x = rng.intInclusive(bounds.x + radius + 1, bounds.x + bounds.w - 1 - (radius + 1));
      const y = rng.intInclusive(bounds.y + radius + 1, bounds.y + bounds.h - 1 - (radius + 1));
      const clear = nodes.every((n) => {
        const need = n.radius + radius + gap;
        return (n.x - x) ** 2 + (n.y - y) ** 2 >= need * need;
      });
      if (clear) {
        nodes.push({ id: nodes.length, x, y, radius });
        break;
      }
    }
  }

  blackboard[LEVEL_NODES] = nodes;
  blackboard[LEVEL_BOUNDS] = bounds;
}
