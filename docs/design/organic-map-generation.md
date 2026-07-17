# Organic Map Generation — Walker and Cellular Automata

Purpose: two structure-stage families that produce organic, cave-like levels — a goal-directed
**walker** and **cellular automata** — and hand every downstream stage the *same* blackboard shape
that BSP and static layouts already produce. Extends [map-generation.md](map-generation.md); builds
on the zone/room contract the BSP pipeline established (see
[`stage-bsp-geometry.js`](../../src/world/generation/stages/stage-bsp-geometry.js)).

> **Design status.** Decided in design conversation, ahead of code — consistent with
> map-generation.md's "grow into, not built upfront." Sections are marked with the **phase** that
> builds them (see *Phasing* at the end). Stage names are the camelCase ids they register under in
> [`pipeline.js`](../../src/world/generation/pipeline.js).

---

## 1. The problem, and the contract we are keeping

Hand-crafted and BSP layouts know their own rooms: the structure stage partitions space, so it tags
rooms as it goes. Organic generators mostly don't — a cellular-automata level is an emergent shape
with no moment during generation where the algorithm could say "this is a chamber."

The temptation is to give organic levels their own vocabulary. We are **not** doing that. The BSP
work earned a single downstream tail — `label`, `stairs`, `spawn`, and `populate` read `level:zones`
and `level:rooms` and never ask which generator ran — and that is the property that makes level
types "pipeline configurations, not separate systems." A parallel `region:*` namespace would fork
that tail and force population stages to branch on generator identity, which is the exact thing the
pipeline model exists to prevent.

So organic chambers become **`level:zones` entries like everything else.** The genuinely new ideas —
that a region has a *kind*, and that some regions are *inferred* rather than *tagged* — land as added
fields on the existing zone object, not a new namespace. See
[ADR-026](architecture-decision-records/adr.md#adr-026-region-model-for-generated-levels).

---

## 2. The region model (merged into zones)

A zone gains two optional fields alongside its existing `{ id, cells, rect, labels }`:

| field | values | meaning |
|---|---|---|
| `kind` | `chamber` \| `passage` \| `junction` | what the space *is*; absent ⇒ treat as `chamber` |
| `origin` | `tagged` \| `inferred` | did a structure stage know it, or did segmentation derive it — **debug only** |

`chamber` is "open space the player perceives as a room." BSP rooms and cave chambers are both
`chamber`; population reads `kind`, never the generator. `passage`/`junction` are connective tissue
and are **only produced by CA segmentation** (phase D) — see §4 on why the walker doesn't emit them.

`origin` is for the visualizer and debugging only. **No downstream stage may branch on it.** It
records whether the region was tagged at source or inferred, so a filmstrip can show which is which;
that is its entire job.

### Rooms become tile-sets, not just rectangles

Today a `level:rooms` entry is a rectangle `{x0,y0,x1,y1}`, and `zone-tiles.js` — the single seam
every population/finishing stage funnels through — expands that rect. An organic chamber is an
irregular tile set. The one load-bearing change is to generalize that seam:

- A room entry may carry an explicit `tiles: [[x,y],…]` array (irregular chambers) **or** stay a
  rect (BSP, grid rooms). `roomTiles` prefers `tiles` when present, else expands the rect.
- A room entry may carry a `core: [x,y]` — a strictly-interior "deep" tile. `centermostRoomTile`
  prefers `core` when present, else falls back to today's nearest-tile-to-centroid. For a lumpy
  cavern the bounding-rect centroid can land near a neck; segmentation's distance-transform peak (§4)
  is a genuinely-interior anchor and comes for free, so it feeds `core` directly.

This is backward compatible: BSP and static rooms keep passing unchanged. It is **phase A** and lands
with no new generator, so the groundwork is proven before any organic code depends on it.

---

## 3. Blackboard vocabulary (reconciled)

Everything below either reuses an existing key or adds one. It does **not** introduce a parallel
region namespace. New keys are declared in
[`blackboard-keys.js`](../../src/world/generation/blackboard-keys.js) beside the existing ones.

| key | status | shape | written by |
|---|---|---|---|
| `level:zones` | **existing, extended** | `[{ id, cells, rect, labels, kind?, origin? }]` | carve / segment |
| `level:rooms` | **existing, extended** | `{ "id,0": { rect? , tiles?, core? } }` | carve / segment |
| `level:adjacency` | **existing, reused** | `[[a,b]]` region adjacency | carve / segment |
| `level:links` | **existing, reused** | `[{ id, a, b }]` realized connections | carve |
| `level:nodes` | **new** | `[{ id, x, y, radius }]` — plan graph, *no tiles yet* | `layoutNodes` |
| `level:edges` | **new** | `[{ a, b, kind }]`, `kind: 'mst' \| 'loop'` | `layoutEdges` |
| `level:chokepoints` | **new** | `[{ x, y, width }]` — narrow tiles between regions | `segmentRegions` |
| `level:reserved` | **new (phase E)** | `[{ x, y, w, h }]` — rects a later stage will fill | any structure stage |

Two things worth noticing:

- **`level:nodes` / `level:edges` are a level plan with no tile data attached.** Layout is a stage
  that writes a graph; carving is a stage that reads it. That seam is where the layout algorithm
  becomes swappable (Poisson-disk today, Lloyd's or hand-authored later) without touching carving.
- **CA's region graph reuses `level:adjacency`, not a new `regionGraph` key.** Region adjacency is
  region adjacency whether BSP declared it or segmentation derived it — same key, so the visualizer
  ([`visualize.js`](../../src/world/generation/visualize.js)) renders both unchanged. Only
  `chokepoints` is a genuinely new concept (the narrow meeting tiles), so it earns a new key.

The plan-vs-realized split: `layoutNodes`/`layoutEdges` write the plan (`level:nodes`/`level:edges`);
the carve stages resolve it into the realized `level:zones`/`level:rooms`/`level:adjacency`/
`level:links` that the shared tail consumes. The visualizer's Mermaid/ASCII views keep working
because they read the realized keys.

---

## 4. Pipeline A — Semi-Sober Walker *(phase B)*

A naive drunkard's walk is not used, and this is recorded so it isn't re-proposed: a pure random
walk's displacement grows as √n, so self-intersection peaks in the middle and *that density is the
shapeless blob* — it's structural, not a tuning problem. No parameter maps monotonically onto
anything a designer wants. The fix is to plan the structure first and let the walk carve between
known endpoints; the organic look always came from corridor deviation, never from aimlessness, so
nothing is lost.

**This pipeline runs no segmentation.** Every chamber is tagged at source, so there is nothing to
infer. Corridors are carved as plain floor tiles and left as **non-zone tiles**, exactly as BSP halls
and `carveHalls` output are today — `populate` never sees them, so no loot lands in a corridor. That
means the whole distance-transform / prominence machinery (§5) belongs to CA and does not exist in
this pipeline. Deferring `passage`/`junction` regions to CA is a deliberate scope cut we agreed on.

### `layoutNodes` → `level:nodes`

Poisson-disk sampling over the level rect (or a `bounds` sub-rect, §6). Minimum separation
`2·maxRadius + 2` keeps chambers distinct; going below it deliberately produces lobed caverns — a
feature, not a bug. `nodeCount` ~8–14 and `radius` ~2–6 skewed low (most chambers small, a few large)
for a phone-sized level. The sampler sits behind the stage, swappable per the seam in §3.

### `layoutEdges` → `level:edges`

Brute-force Euclidean **MST** for the connective backbone, then add back `loopFactor` of the
shortest non-tree edges as `loop` edges, each accepted only if it doesn't cross an already-accepted
edge (a cheap segment-intersection test). `loopFactor` ~0.15–0.3; `0` yields a tree, and trees play
as dead ends.

**We do not use Delaunay triangulation here.** It elegantly bundles MST-containment, planarity, and
near-neighbour edges into one structure — but only earns that at scale, and it adds a floating-point
degeneracy surface that fights our "determinism is the assertion" contract. At the physically
reachable chamber counts (a phone map holds ~30–40 chambers before min-separation stops placement),
brute force is instant and trivially seed-stable. Full reasoning and the swap-in path are in
[ADR-028](architecture-decision-records/adr.md#adr-028-organic-generation-performance-envelope). The
`level:edges` seam means Delaunay drops in behind the same interface if a level ever wants hundreds of
nodes.

### `carveChambers` → tiles, `chamber` zones (tagged)

For each node, a stationary walker with the chamber brush runs `radius²` steps, producing a blob
rather than a disc. Each becomes a `level:zones` entry with `kind: 'chamber'`, `origin: 'tagged'`,
and a `level:rooms` entry carrying the chamber's `tiles` and a `core` (the node centre). Tagged at
source — no inference.

### `carveCorridors` → tiles (non-zone), `level:links`

One goal-biased walk per edge, node A → node B:

- `sobriety` ~0.65 — P(step toward target) vs. P(random step).
- `momentum` ~0.5 — bias toward repeating the last heading, applied to the *random* branch only.
- **bimodal brush** — tunnel width 1, chamber width 3, never interpolated. (A continuously varying
  brush would smear the distance field into a continuum and defeat the CA segmenter, so we keep the
  brush bimodal even here, for consistency and in case the audit segmenter runs.)
- termination — brush overlaps the target node's tiles.
- `maxSteps` = `4·chebyshev(A,B)`; on overrun, Bresenham the remainder.

**One target at a time.** Waypoints (A→B→C) are fine — three edges with momentum carried through.
Summing attraction toward multiple targets sends the walker to the centroid, where it stalls.

Two guards are load-bearing. The **`maxSteps` Bresenham fallback** makes non-arrival *impossible*
rather than unlikely — a walker that fails to arrive leaves a disconnected level, the one bug that
ruins a run (and the connectivity audit in phase C is what proves it never happens). The **bimodal
brush** keeps chambers and corridors separable if segmentation is ever run as an audit.

Corridors write `level:links`/`level:adjacency` so the graph the visualizer draws matches the plan,
but they carve plain tiles and create **no** zone.

---

## 5. Pipeline B — Cellular Automata *(phase D)*

### `caSeed` → tiles

Random fill: each interior tile is wall with probability `wallChance` (~0.45; below ~0.42 opens into
one blob, above ~0.48 fragments into disconnected soup). Force the level border to wall.

### `caSmooth` → tiles

A tile becomes wall if ≥5 of its 8 neighbours are wall. `iterations` ~4 (5–6 over-rounds and closes
the necks that segmentation is looking for). Fixed iteration count keeps this O(tiles).

### `caBridge` → tiles (non-zone), `level:links`

Find connected components; discard any below `minComponentSize` (~30 tiles). Bridge the survivors:
MST over component **centroids** (O(components²) — *not* over tiles, see the raster discipline in
ADR-028), each bridge carved with the same goal-biased walker at high sobriety (~0.85) so bridges
read as deliberate. Bridges are tagged connective tissue.

**This runs before segmentation.** Segment first and the bridges arrive with no region assignment and
the region graph is silently wrong.

### `segmentRegions` → `level:zones` (`origin: 'inferred'`), `level:adjacency`, `level:chokepoints`

The stage CA earns. It consumes no RNG and is a pure function of geometry.

1. **Distance transform.** `D(x,y)` = Chebyshev distance from each floor tile to the nearest wall,
   two O(n) sweeps. A 1-wide corridor has `D=1`; a cavern centre has `D=6`. This is the narrow-gap
   detector.
2. **Cores.** Local maxima of `D` are chamber cores. Each becomes a chamber's `core` (§2).
3. **Flood.** Grow outward from cores in descending `D` order until regions collide.
4. **Merge on prominence.** Where two regions meet is a saddle; merge them unless at least one peak
   rises more than `prominence` above the meeting point. This is mountain prominence — one integer
   decides whether a lumpy cavern reads as one chamber or three, mapping directly onto what a player
   perceives as a separate space. `prominence` ~2 to start.

Each surviving region becomes a `level:zones` entry: `kind: 'chamber'` if its core clears
`passageThreshold` (tiles with `D ≤ 1` are `passage`, not undersized rooms), `origin: 'inferred'`,
with its `tiles` and `core`. Region collisions produce `level:adjacency`; the low-`D` meeting tiles
produce `level:chokepoints` (door / ambush / guard-post candidates, straight to population).

**Jagged CA walls are not a problem.** A single-tile wall nub yields a spurious `D` peak with
near-zero prominence, so the merge step eats it on the first pass — the knob for "one cavern or
three" *is* the denoiser. No separate smoothing pass.

**Determinism is load-bearing.** Segmentation draws no RNG, so it must tie-break by **tile index,
never by Set/Map iteration order** — the failure is silent and seed-fragile. See
[ADR-027](architecture-decision-records/adr.md#adr-027-region-segmentation-via-distance-transform-and-prominence-merge).

Running the segmenter over *other* generators is a useful self-test: over BSP it reproduces the rooms
the structure stage already knew (a clean regression check); over a fixed-width walker maze it
correctly reports one big `passage` and no chambers. Both are honest, not failures — so segmentation
is available as an **optional audit** over any pipeline, and is only *required* for CA.

---

## 6. Composition — two modes

Both organic families must compose with other generators, the same way BSP already can.

**Mode #2 — generate inside a rectangle of a larger, in-progress map.** Already solved for BSP and
adopted verbatim: a structure stage takes a `bounds` `{x,y,w,h}` param and owns the tile grid only
when none exists yet, otherwise carving in place; `outerWall: false` leaves the enclosing box's own
wall standing (see [`stage-bsp-carve.js`](../../src/world/generation/stages/stage-bsp-carve.js)). The
walker and CA stages adopt the identical convention — this is pattern-matching existing code, low
risk, and part of phases B/D.

**Mode #1 — cordon off a rectangle for a *later* stage to populate.** Genuinely new; no stage today
reserves space. A structure stage publishes `level:reserved` (a list of rects); organic generators
treat reserved rects as off-limits — CA forces those cells to stay wall/excluded, the walker treats
them as hard bounds / repellent. This is **phase E**, deliberately after both generators work
end-to-end, and is the feature that lets a single pipeline compose multiple structure stages (e.g. a
BSP wing beside a CA cavern) to prove out the whole system.

---

## 7. Shared tail — unchanged

Both pipelines hand off the same thing they always did. `populate` reads `kind == 'chamber'` (absent
⇒ chamber) and the zone's room tiles; `stairs`/`spawn` place on `centermostRoomTile`, which now
prefers the `core`. `label` assigns roles over the zone set geometry-agnostically. None of these
stages know which pipeline ran — if one ever branches on generator identity or on `origin`, the
abstraction has failed and the fix belongs in the region fields, not the population stage.

---

## 8. Performance envelope

Two independent scaling axes, and they must not be conflated:

- **Chamber count `n`** (the graph work in `layoutEdges`). Even the worst term (an O(n³) crossing
  test) stays instant to ~300 chambers, and `n` is physically capped by map area / min-separation.
  Brute force ships; there is no reachable input where it is the bottleneck.
- **Tile count `T`** (all raster work: carving, CA smoothing/DT/flood). These are O(T) or O(T·k) with
  small fixed `k`, so a 10× map is a linear 10× cost. The one real trap is an accidental **O(T²)**
  inner loop (a tile loop nested over tiles — the danger zone is `caBridge`'s nearest-component
  search, which is why it bridges centroids, not tiles).

The discipline is a code-review rule — *no tile loop nests over tiles* — enforced by a per-pipeline
**perf-budget test** that runs each generator at ~4× map dimensions (~16× tiles) under a wall-clock
budget. That test lands in **phase C**, before the walker, so the budget exists as a gate from the
start. Full reasoning in
[ADR-028](architecture-decision-records/adr.md#adr-028-organic-generation-performance-envelope).

---

## 9. Determinism and the seed contract

All randomness comes from the injected `mapgen` rng (ADR-024); `Math.random()` is forbidden.
Segmentation additionally consumes **no** RNG and must be a pure function of geometry (§5).

ADR-009's "stage order must be stable for seeds to reproduce" is too narrow: stage **parameters** are
equally part of the reproducibility surface. Changing `nodeCount`, `loopFactor`, `wallChance`,
`iterations`, or `prominence` re-rolls existing seeds exactly as reordering stages does, and just as
silently. The seed reproduces a level only in combination with a fixed stage order **and** fixed stage
parameters — both are the contract. See
[ADR-029](architecture-decision-records/adr.md#adr-029-generation-parameters-are-part-of-the-seed-contract).

---

## 10. Phasing

Each phase is shippable and testable on its own; new floors attach to the **existing BSP branch**
(branch 1 in [`data/transit-map.js`](../../data/transit-map.js)), one per generator as it matures.

| phase | what lands | proves |
|---|---|---|
| **A** | Region-model groundwork: `kind`/`origin` on zones; tile-set `level:rooms`; generalized `zone-tiles.js`. No new generator. | BSP + statics still pass; the seam is ready. |
| **B** | Semi-sober walker: `layoutNodes` → `layoutEdges` → `carveChambers` → `carveCorridors`. No segmentation. One walker floor wired into the BSP branch. | Organic levels through the existing tail. |
| **C** | Shared invariant tests: connectivity (flood-fill from entry reaches all zones/stairs) + perf budget, across all procedural pipelines. | The load-bearing guards, enforced. |
| **D** | Cellular automata: `caSeed` → `caSmooth` → `caBridge` → `segmentRegions`. Brings `passage`/`junction` regions, `chokepoints`. One CA floor wired in. | Inference-based regions; the second generator on one tail. |
| **E** | Composition: `bounds` on organic stages (cheap), then `level:reserved` cordoning; a couple of composed floors mixing generators in one pipeline. | The whole system — multiple structure stages, one level. |

---

## 11. Deferred

- **Districts** — per-cluster containment for thematic quarters (a flooded quarter, a barracks). A
  content feature; no architecture needed until a concrete level wants it.
- **Score-and-reject** — generate/measure/reroll if output quality proves inconsistent. Changes what
  a seed means (it becomes "the first acceptable roll"), same hazard class as stage order; don't add
  it casually. The segmenter is the scorer if we ever do.
- **Delaunay layout / Lloyd's relaxation** — the `level:edges` and `layoutNodes` seams exist; swap in
  if a level ever wants hundreds of nodes or a clumpy→regular dial. Brute force + Poisson-disk are the
  defaults until then.
