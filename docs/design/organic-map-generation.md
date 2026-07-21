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

Random fill: each interior tile is wall with probability `wallChance`, border forced to wall. The
draft's "~0.45" was the blind estimate and is wrong for the pure ≥5 rule: because that rule erodes a
wall *minority*, walls must start in the **majority** to survive smoothing. Measured against real
output, ~0.55 leaves one dominant cavern plus specks, **~0.62** (the default) breaks into several
distinct caverns at ~⅓ floor, and much above ~0.64 the caves turn cramped and twisty. (A two-rule CA —
also filling large open areas — would give defined chambers at lower density; deferred unless the
single rule proves insufficient.)

### `caSmooth` → tiles

A tile becomes wall if ≥5 of its 8 neighbours are wall. `iterations` ~4 (5–6 over-rounds and closes
the necks that segmentation is looking for). Fixed iteration count keeps this O(tiles).

### `caBridge` → tiles, `level:passageTiles`

Find connected components; discard any below `minComponentSize` (~30 tiles), but always keep the
single largest so the level is never wiped. Bridge the survivors: MST over component **representatives**
(the floor tile nearest each centroid — O(components²), *not* over tiles, see the raster discipline in
ADR-028), each bridge carved with the same goal-biased walker at high sobriety (~0.85) so bridges read
as deliberate.

**The digger knows what it dug.** The walker reports the tiles it turned from wall to floor — the
tunnel it *created*, as opposed to the existing floor it merely passed through. Those dug tiles are the
level's genuine connective tissue, published as `level:passageTiles` for `segmentRegions` to tag
`passage`. This is how passages emerge at all: a bridge is width-1, so the watershed would otherwise
split it down the middle between the two chambers and no passage region would form. Tagging at the
source (the digger) is strictly better than trying to re-infer it.

**This runs before segmentation.** Segment first and the bridges arrive with no region assignment and
the region graph is silently wrong.

### `segmentRegions` → `level:zones` (`origin: 'inferred'`), `level:adjacency`, `level:chokepoints`

The stage CA earns. It consumes no RNG and is a pure function of geometry.

1. **Distance transform.** `D(x,y)` = Chebyshev distance from each floor tile to the nearest wall,
   two O(n) sweeps. A 1-wide corridor has `D=1`; a cavern centre has `D=6`. This is the narrow-gap
   detector.
2. **Watershed the chamber floor** (everything but the dug `passageTiles`) in descending `D`: a tile
   with no labelled neighbour is a core; otherwise it joins its neighbours. Excluding the passages
   means a deliberate bridge never merges the two chambers it joins.
3. **Merge on prominence.** A tile that first connects two basins is a saddle at height `S`; merge them
   unless the *shallower* peak clears it — keep separate iff `min(peakA,peakB) − S > prominence`. One
   integer decides whether a lumpy cavern reads as one chamber or several. **`prominence` 0** is the
   tuned default (measured against rendered CA output — the blind draft's "~2" over-merged everything
   into one blob). Saddle tiles are **divides**: they don't propagate a region (or a basin bleeds
   through a neck into its neighbour) and are assigned to a region only afterward.

Each chamber basin becomes a `level:zones` entry (`kind: 'chamber'`, `origin: 'inferred'`, with its
`tiles` and `core`); a basin whose peak never clears `passageThreshold` is a `passage` instead. The
dug `passageTiles` become their own `passage` regions (their connected components). Regions that touch
produce `level:adjacency`; the narrowest (lowest-`D`) boundary tile of each pair is a
`level:chokepoint` (door / ambush / guard-post candidate, straight to population).

> **Passages come from the digger, not the watershed.** In practice a watershed over cave floor rarely
> yields a standalone `passage` region — the connective necks get absorbed into the chambers they join,
> surfacing instead as chokepoints. Real passage *regions* come from `caBridge` tagging the tiles it
> dug (above). The `passageThreshold` rule remains a cheap catch for a genuinely thin basin.

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

## 6. Composition

A composed level runs several structure sections in one pipeline — a BSP wing beside a CA cavern —
over a shared grid, then the usual tail. Phase E builds the machinery; this section is **as-built**
where marked, with the remainder still pending.

**Mode #2 — generate inside a rectangle** *(built)*. A structure stage takes a `bounds` `{x,y,w,h}`
param and owns the tile grid only when none exists yet, otherwise carving in place; `outerWall: false`
leaves the enclosing wall standing (see
[`stage-bsp-carve.js`](../../src/world/generation/stages/stage-bsp-carve.js)). The CA stages read
`level:bounds` for their region. To give sections a grid to carve into, the **`box`** stage runs first
and lays the full map as solid wall (the "canvas") — the box-first precondition, now concrete.

**The assembly seam — `appendZones`** *(built)*. Zone-producing stages used to *overwrite*
`level:zones`/`rooms`/`adjacency`, so a second section erased the first and both numbered ids from 0.
[`appendZones`](../../src/world/generation/zone-tiles.js) merges a stage's zone graph into the
blackboard, **offsetting its ids by the running zone count** (remapping cells, `"id,0"` room keys, and
adjacency/link pairs). `bspGeometry` and `segmentRegions` append through it; at base 0 it's identical
to the old direct write, so single-section pipelines are unchanged. This closed the **zone-id
namespacing** gap for BSP and CA.

**Joining the sections — `stitch`** *(built)*. Bounded sections are disjoint floor components, so a
composed level is disconnected until `stitch`
([`stage-stitch.js`](../../src/world/generation/stages/stage-stitch.js)) carves short room-to-room
corridors between them. It flood-fills components, then union-finds the shortest chamber-frontier gaps
until everything is one component (a nearest-pair fallback guarantees it), dropping a door on each and
recording adjacency. `maxConnections` is a best-effort ceiling on *separate* non-crossing connections
(overlap-rejection is exact non-crossing for orthogonal corridors); connectivity itself is always
free. Two notes from building it:

- **`stitch` operates on the whole level, never `level:bounds`.** By the time it runs, `level:bounds`
  holds only the *last* section's sub-rect (see the last-writer-wins gotcha below) — reading it made
  `stitch` flood one half, mistake the other half's tiles for a separate component, and leave the
  level disconnected. It uses `level.width/height`, with an optional `bounds` param for a future
  embedded case.
- **Three-plus areas work in one pass** — union-find connects N components into one regardless of
  count, guided purely by gap length (a linear A│B│C layout naturally chains A–B–C). The one caveat:
  `maxConnections` caps *extra* connections globally, drawn shortest-first, so with several seams of
  unequal width the extras pile onto the tightest seam rather than distributing. Per-seam control
  (different `maxConnections`/`maxGap`, or balanced redundancy) is a deliberate **multi-pass**: run
  `stitch` once per seam region via its `bounds` param. Per-seam balancing in a single pass (cap
  extras per component-pair) is a documented option, not built — connectivity never needs it.

**`level:bounds` is a single, last-writer-wins slot** *(confirmed)* — "the current section's rect,"
not a durable map size. The box establishes the grid; each section overwrites `level:bounds` with its
own rect; nothing may treat it as the map extent (`stitch` was the first to get bitten). A durable
"full map" key could be added if more stages need it.

**Mode #1 — reserved areas** *(built)*. The `reserve` stage publishes `level:reserved` rects a *later*
stage fills; `caSeed`/`caSmooth` hold those cells wall (see
[`stage-reserve.js`](../../src/world/generation/stages/stage-reserve.js), the shared `isReserved`
predicate). The intended pipeline is `box → reserve → CA (grows around the hole) → BSP (fills the hole)
→ stitch`. `caBridge` is reserved-aware: it takes a `blocked` predicate the shared walker won't step
onto or carve, **and** skips any bridge whose straight line crosses a reserved rect. That skip matters
— a central hole can split the cave into arcs, and without it `caBridge` would tunnel a bridge across
the hole that the BSP fill then overwrites in the middle, leaving two dead-end stubs. Instead the arcs
are left unbridged and `stitch` joins them to the filled block. (The walker still can't *path-find*
around a big obstacle; the straight-line skip is what keeps it honest.)

**District population** *(built)*. `appendZones` stamps an optional `section` id on a stage's zones
(`bspGeometry`/`segmentRegions` pass it from config), and `label`/`populate` take a `section` filter —
so a composed floor labels and populates each district separately (BSP wing gets orcs, cave gets
goblins) by running those stages once per section. Absent a `section`, both span the whole floor
unchanged. `stairs`/`spawn` find their zone by label, so scoping `label` scopes them too.

### Still pending

- **Walker in composition.** `carveChambers`/`carveCorridors` couple zone id to `node.id`
  (`carveCorridors` resolves target tiles and writes links by node id), so the walker isn't
  append-safe yet and stays single-section. Not needed for the BSP+CA demo; a coordinated change when
  a composed floor wants a walker section.

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

The discipline is a code-review rule — *no tile loop nests over tiles* — enforced by a **deterministic
work-count test** rather than a wall-clock one (a timing assertion is flaky and slows the suite). As
built, it counts tile-grid reads at 1× and 16× tile scale via a read-counting Proxy and asserts the
ratio is roughly linear (≈16×), not quadratic (≈256×) — no clock, deterministic. It lives beside
`caBridge` (`stage-ca-bridge.test.js`), the one stage with a real nearest-component O(T²) trap; the
other stages have no super-linear tile loop to guard. Full reasoning in
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
| **C** | Shared connectivity invariant (flood-fill from entry reaches every zone/stair) across all procedural pipelines. (Perf guard moved to D, beside its only real O(T²) risk.) | The load-bearing connectivity guarantee, enforced. |
| **D** | Cellular automata: `caSeed` → `caSmooth` → `caBridge` → `segmentRegions`; brings inferred `passage` regions (from the digger's dug tiles) + `chokepoints`, and the deterministic work-count perf test. One CA floor wired in. (`junction` kind exists but is unproduced — deferred.) | Inference-based regions; the second generator on one tail. |
| **E** | Composition. Built: `box` canvas, `appendZones` id-namespacing + `section` seam, `stitch` (connect sections, `maxConnections`), `reserve` (`level:reserved`), district (`section`-scoped `label`/`populate`). Pending: the composed demo floor(s). | The whole system — multiple structure stages, one connected level. |
| **F** | A standalone map-gen visualizer dev page (like the sprite finder): pick a pipeline, seed, and params; render the level and its zone graph, ideally stepping stage by stage via the `onStageComplete` seam. Supersedes the ad-hoc scratchpad renders used to tune each phase. | Fast visual iteration on pipelines and tuning. |

---

## 11. Deferred

- **District *containment*** — the `section`-scoped label/population mechanism is built (§6); what's
  deferred is *geometric* containment of a walker's corridors to its own cluster (a flooded quarter, a
  barracks that stays home). A content feature; no architecture needed until a concrete level wants it.
- **Score-and-reject** — generate/measure/reroll if output quality proves inconsistent. Changes what
  a seed means (it becomes "the first acceptable roll"), same hazard class as stage order; don't add
  it casually. The segmenter is the scorer if we ever do.
- **Delaunay layout / Lloyd's relaxation** — the `level:edges` and `layoutNodes` seams exist; swap in
  if a level ever wants hundreds of nodes or a clumpy→regular dial. Brute force + Poisson-disk are the
  defaults until then.
