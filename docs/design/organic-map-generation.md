# Organic Map Generation — Walker, Cellular Automata, and Composition

Two structure-stage families that produce organic, cave-like levels — a goal-directed **walker** and
**cellular automata** — plus the **composition** machinery that runs several structure sections in one
level. All of it hands every downstream stage the *same* blackboard shape that BSP and static layouts
already produce, so level types stay "pipeline configurations, not separate systems." Extends
[map-generation.md](map-generation.md) and builds on the zone/room contract the BSP pipeline
established (see [`stage-bsp-geometry.js`](../../src/world/generation/stages/stage-bsp-geometry.js)).
Stage names are the camelCase ids they register under in
[`pipeline.js`](../../src/world/generation/pipeline.js).

---

## 1. The problem, and the contract it keeps

Hand-crafted and BSP layouts know their own rooms: the structure stage partitions space, so it tags
rooms as it goes. Organic generators mostly don't — a cellular-automata level is an emergent shape
with no moment during generation where the algorithm could say "this is a chamber."

The tempting response is to give organic levels their own vocabulary. This design does not. The BSP
work earned a single downstream tail — `label`, `stairs`, `spawn`, and `populate` read `level:zones`
and `level:rooms` and never ask which generator ran — and that is the property that makes level types
pipeline configurations rather than separate systems. A parallel `region:*` namespace would fork that
tail and force population stages to branch on generator identity, which is the exact thing the pipeline
model exists to prevent.

So organic chambers become **`level:zones` entries like everything else.** The genuinely new ideas —
that a region has a *kind*, and that some regions are *inferred* rather than *tagged* — land as added
fields on the existing zone object, not a new namespace. See
[ADR-026](architecture-decision-records/adr.md#adr-026-region-model-for-generated-levels).

---

## 2. The region model

A zone gains three optional fields alongside its existing `{ id, cells, rect, labels }`:

| field | values | meaning |
|---|---|---|
| `kind` | `chamber` \| `passage` \| `junction` | what the space *is*; absent ⇒ treat as `chamber` |
| `origin` | `tagged` \| `inferred` | did a structure stage know it, or did segmentation derive it — **debug only** |
| `section` | any id | which composition district the zone belongs to (§6); absent on single-section floors |

`chamber` is "open space the player perceives as a room." BSP rooms and cave chambers are both
`chamber`; population reads `kind`, never the generator. `passage` is connective tissue, produced only
by CA segmentation (§5). (`junction` is reserved in the model but not yet produced by any stage — see
§10.)

`origin` is for the visualizer and debugging only. **No downstream stage may branch on it.** It records
whether a region was tagged at source or inferred, so a render can show which is which; that is its
entire job. `isChamber` (in [`zone-tiles.js`](../../src/world/generation/zone-tiles.js)) is the single
definition of the "absent ⇒ chamber" rule, so no consumer re-derives it.

### Rooms are tile-sets or rectangles

A `level:rooms` entry is either a rectangle `{x0,y0,x1,y1}` (BSP, grid, static rooms) or an irregular
tile set `{tiles:[[x,y]…]}` (organic chambers). Either may also carry `core:[x,y]`, a strictly-interior
"deep" tile. [`zone-tiles.js`](../../src/world/generation/zone-tiles.js) is the single seam every
population/finishing stage funnels through, so it hides the difference:

- `roomTiles` uses an explicit `tiles` list when present, else expands the rect.
- `centermostRoomTile` prefers `core` when present, else falls back to the room tile nearest the zone
  centroid. For a lumpy cavern the bounding-rect centroid can land on a wall or a neck; segmentation's
  distance-transform peak (§5) is a genuinely-interior anchor and feeds `core` directly.

---

## 3. Blackboard vocabulary

Every key below either reuses an existing one or adds one beside it in
[`blackboard-keys.js`](../../src/world/generation/blackboard-keys.js) — there is no parallel region
namespace.

| key | shape | written by |
|---|---|---|
| `level:zones` | `[{ id, cells, rect, labels, kind?, origin?, section? }]` | carve / segment / `appendZones` |
| `level:rooms` | `{ "id,0": { rect? , tiles?, core? } }` | carve / segment |
| `level:adjacency` | `[[a,b]]` region adjacency | carve / segment / stitch |
| `level:links` | `[{ id, a, b }]` realized connections | carve |
| `level:nodes` | `[{ id, x, y, radius }]` — plan graph, *no tiles yet* | `layoutNodes` |
| `level:edges` | `[{ a, b, kind }]`, `kind: 'mst' \| 'loop'` | `layoutEdges` |
| `level:bounds` | `{ x, y, w, h }` — the *current section's* rect (last-writer-wins, §6) | `box` / structure stages |
| `level:reserved` | `[{ x, y, w, h }]` — rects a later stage will fill | `reserve` |
| `level:passageTiles` | `[[x,y]]` — the tiles a digger dug | `caBridge` |
| `level:chokepoints` | `[{ x, y, width }]` — narrow tiles between regions | `segmentRegions` |

Two seams are load-bearing:

- **`level:nodes` / `level:edges` are a level plan with no tile data.** Layout is a stage that writes a
  graph; carving is a stage that reads it. That split is where the layout algorithm becomes swappable
  (dart-throwing today, Poisson-disk or hand-authored later) without touching carving.
- **A region graph reuses `level:adjacency`, not a new key.** Region adjacency is region adjacency
  whether BSP declared it or segmentation derived it — same key, so the visualizer renders both
  unchanged. Only `chokepoints` (the narrow meeting tiles) is a genuinely new concept, so it earns a
  new key.

The plan-vs-realized split: `layoutNodes`/`layoutEdges` write the plan; the carve stages resolve it
into the realized `level:zones`/`rooms`/`adjacency`/`links` the shared tail consumes.

---

## 4. The semi-sober walker

A naive drunkard's walk is deliberately **not** used: a pure random walk's displacement grows as √n,
so self-intersection peaks in the middle and *that density is the shapeless blob* — structural, not a
tuning problem, and no parameter maps monotonically onto anything a designer wants. Instead the
structure is planned first and the walk carves between known endpoints; the organic look always came
from corridor deviation, never from aimlessness, so nothing is lost.

This pipeline runs **no segmentation** — every chamber is tagged at source, so there is nothing to
infer, and the distance-transform machinery (§5) belongs to CA. Corridors are carved as plain floor
and left as **non-zone tiles**, exactly like BSP halls, so `populate` never drops loot in one.

The shipped floor (`data/pipelines/walker.js`) is `layoutNodes → layoutEdges → carveChambers →
carveCorridors`, then the shared tail.

### `layoutNodes` → `level:nodes`

Chamber sites as a plan graph — points with radii, no tiles. Sampling is **dart-throwing with
rejection**: up to `attempts` (30) random positions per node, keeping the first whose chamber clears
every placed chamber by at least `gap` (2) wall tiles. Separation is checked against each pair's *actual*
radii (distance ≥ rA + rB + gap), not a single global worst-case — a global minimum would reserve
max-radius room for every pair and, since most chambers are small, silently yield far fewer than
`nodeCount`. `nodeCount` (12) is therefore a target/ceiling; a crowded map yields fewer. `radius` is
drawn **uniformly** over `[2, 6]` — chamber *area* grows as radius², so uniform radius already weights
floor coverage toward the larger chambers. The sampler sits behind the stage seam (§3), swappable per
level without touching carving.

### `layoutEdges` → `level:edges`

A brute-force Euclidean **MST** for the connective backbone, then `loopFactor` (0.2, floors run ~0.25)
of the shortest non-tree edges added back as `loop` edges — each accepted only if it crosses no
already-accepted edge (a cheap proper-segment-intersection test, so the plan stays roughly planar).
`loopFactor` 0 yields a pure tree, and trees play as dead ends.

Delaunay triangulation is deliberately not used: it bundles MST-containment, planarity, and
near-neighbour edges elegantly but only earns that at scale, and it adds a floating-point degeneracy
surface that fights the "determinism is the assertion" contract. At the reachable chamber counts (a
phone map holds ~30–40 before separation stops placement) brute force is instant and trivially
seed-stable. Full reasoning and the swap-in path (the `level:edges` seam) are in
[ADR-028](architecture-decision-records/adr.md#adr-028-organic-generation-performance-envelope).

### `carveChambers` → tiles, `chamber` zones (tagged)

Each node is carved by a **leashed random walker** painting a plus-brush for `radius²` steps, with both
walker and brush clipped to within Chebyshev `radius` of the centre. Because each step's brush overlaps
the last, the result is one connected blob (not a stamped disc) that always includes the centre — so
the `core` is guaranteed floor. Each chamber becomes a `level:zones` entry (`kind: 'chamber'`,
`origin: 'tagged'`) and a `level:rooms` entry carrying its `tiles` and its `core` (the node centre).

### `carveCorridors` → tiles (non-zone), `level:links`

One goal-biased, width-1 walk per edge, node A → node B:

- `sobriety` (0.65) — P(step toward the target) per step; otherwise the walker wanders.
- `momentum` (0.5) — on a wander step, P(repeat the last heading) vs. a random turn. That deviation is
  where the organic look comes from.
- It stops as soon as it enters the target chamber's tiles (the two chambers are then joined).
- `maxStepsFactor` (4) — a step budget of `4·chebyshev(A,B)`; on overrun, a straight line finishes the
  remainder.

The straight-line fallback is load-bearing: it makes non-arrival **impossible** rather than merely
unlikely — a walker that fails to arrive leaves a disconnected level, the one bug that ruins a run.
Corridors publish `level:links`/`level:adjacency` so the graph matches the plan, but they carve plain
floor and create **no** zone. One target at a time: waypoints (A→B→C as three edges) are fine, but
summing attraction toward multiple targets sends the walker to the centroid, where it stalls.

The two fixed brush widths (plus-brush chambers, width-1 corridors) keep chambers and corridors
separable by distance transform, so the CA segmenter (§5) can be run as an optional audit over a walker
level and still tell them apart.

---

## 5. Cellular automata

The shipped floor (`data/pipelines/ca.js`) is `caSeed → caSmooth → caBridge → segmentRegions`, then
the shared tail.

### `caSeed` → tiles

Random fill: each interior tile is wall with probability `wallChance`, the border forced to wall.
Because the ≥5 smoothing rule erodes a wall *minority*, walls must start in the **majority** to survive:
measured against rendered output, ~0.55 leaves one dominant cavern plus specks, **0.62** (the default)
breaks into several distinct caverns at ~⅓ floor, and much above ~0.64 the caves turn cramped and
twisty.

### `caSmooth` → tiles

A tile becomes wall if ≥ `wallThreshold` (5) of its 8 neighbours are wall, iterated `iterations` (4)
times — 5–6 over-rounds and closes the necks segmentation looks for. Pure and deterministic (no RNG);
each pass reads a snapshot and writes the whole region, so there is no in-place bleed. Fixed iteration
count keeps it O(tiles).

### `caBridge` → tiles, `level:passageTiles`

Find the connected floor components; discard any below `minComponentSize` (30), but always keep the
single largest so the level is never wiped. Bridge the survivors along an MST over their
**representatives** — the floor tile nearest each component's centroid (O(components²), reading each
component's own tiles, *not* over all tiles; see the raster discipline in §8). Each bridge is carved by
the shared goal-biased walker at high `sobriety` (0.85) so it reads as a deliberate tunnel.

**The digger knows what it dug.** The walker reports the tiles it turned from wall to floor — the tunnel
it *created*, as opposed to existing floor it merely passed through. Those dug tiles are the level's
genuine connective tissue, published as `level:passageTiles` for `segmentRegions` to tag `passage`.
This is how passages emerge at all: a bridge is width-1, so a plain watershed would split it down the
middle between the two chambers and no passage region would form. This runs **before** segmentation —
segment first and the bridges arrive with no region assignment and the region graph is silently wrong.

### `segmentRegions` → `level:zones` (`inferred`), `level:adjacency`, `level:chokepoints`

The stage CA earns — it infers regions from finished geometry. It consumes no RNG and is a pure function
of geometry (tie-breaks by tile index).

1. **Distance transform.** `D(x,y)` = Chebyshev distance from each floor tile to the nearest wall, by
   two O(tiles) chamfer sweeps. A 1-wide neck has `D=1`; a cavern centre `D=4+`. This is the narrow-gap
   detector.
2. **Watershed the chamber floor** (everything but the dug `passageTiles`) in descending `D`: a tile
   with no labelled neighbour starts a region (a local peak / core); otherwise it joins its neighbours'.
   Excluding the passages means a deliberate bridge never merges the two chambers it joins.
3. **Merge on prominence.** The tile that first connects two basins is their highest saddle; merge them
   unless the *shallower* peak clears it — keep separate iff `min(peakA, peakB) − saddle > prominence`.
   One integer decides whether a lumpy cavern reads as one chamber or several. **`prominence` 0** is the
   tuned default (measured against rendered CA output; higher values over-merge). Saddle tiles are
   **divides**: they don't propagate a region (or a basin bleeds through a neck into its neighbour) and
   are assigned to a region only afterward.

Each surviving basin becomes a `level:zones` entry (`kind: 'chamber'`, `origin: 'inferred'`, with its
`tiles` and `core`); a basin whose peak never clears `passageThreshold` (1) is a `passage` instead. The
dug `passageTiles` become their own `passage` regions (their connected components). Regions that touch
produce `level:adjacency`; the narrowest (lowest-`D`) boundary tile of each pair becomes a
`level:chokepoint` — a door / ambush / guard-post candidate, straight to population.

> **Passages come from the digger, not the watershed.** A watershed over cave floor rarely yields a
> standalone `passage` region — the connective necks get absorbed into the chambers they join,
> surfacing instead as chokepoints. Real passage *regions* come from `caBridge` tagging the tiles it
> dug. The `passageThreshold` rule remains a cheap catch for a genuinely thin basin.

**Jagged CA walls are not a problem.** A single-tile wall nub yields a spurious `D` peak with near-zero
prominence, so the merge step eats it on the first pass — the "one cavern or three" knob *is* the
denoiser. No separate smoothing pass. Segmentation draws no RNG, so it must tie-break by **tile index,
never Set/Map iteration order** (a silent, seed-fragile failure); see
[ADR-027](architecture-decision-records/adr.md#adr-027-region-segmentation-via-distance-transform-and-prominence-merge).

Running the segmenter over *other* generators is a useful self-test: over BSP it reproduces the rooms
the structure stage already knew (a clean regression check); over a fixed-width maze it reports one big
`passage` and no chambers. Both are honest — so segmentation is an **optional audit** over any pipeline,
and only *required* for CA.

---

## 6. Composition

A composed level runs several structure sections in one pipeline — a BSP wing beside a CA cavern — over
a shared grid, then the usual tail. The shipped demo is `data/pipelines/composite.js`
(`branch-1-floor-4`): a BSP keep in the west half and a CA cave in the east, stitched together and
populated per district (a garrison in the keep, vermin in the cave).

**The canvas — `box`.** So sections have a grid to carve into, the `box` stage runs first and lays the
full map (default 48×32; the floor runs 56×40) as solid wall, publishing `level:bounds`. A
single-section pipeline doesn't need it — the structure stage sizes the grid itself.

**Generating inside a rectangle.** A structure stage takes a `bounds` `{x,y,w,h}` param and owns the
tile grid only when none exists yet, otherwise carving in place. `bspCarve` respects `outerWall: false`
(from the plan) to leave the enclosing box wall standing; the CA stages read `level:bounds` for their
region. This is how the composite floor puts BSP in `{x:0,w:28}` and CA in `{x:28,w:28}` of one 56-wide
box.

**Assembling zones — `appendZones`.** Zone-producing stages once *overwrote* `level:zones`/`rooms`/
`adjacency`, so a second section erased the first and both numbered ids from 0.
[`appendZones`](../../src/world/generation/zone-tiles.js) instead merges a stage's zone graph into the
blackboard, **offsetting its ids by the running zone count** (remapping cells, `"id,0"` room keys, and
adjacency/link pairs) and optionally stamping a `section` id on each zone. `bspGeometry` and
`segmentRegions` append through it; at base 0 with no section it is identical to the old direct write,
so single-section pipelines are unchanged.

**Joining the sections — `stitch`.** Bounded sections are disjoint floor components, so a composed level
is disconnected until `stitch` ([`stage-stitch.js`](../../src/world/generation/stages/stage-stitch.js))
carves short room-to-room corridors across the gaps. It flood-fills components, then union-finds the
shortest chamber-frontier gaps until everything is one component (a nearest-pair fallback guarantees
it), dropping a door on each and recording adjacency. `maxConnections` is a best-effort ceiling on
*separate* non-crossing connections (overlap-rejection is exact non-crossing for orthogonal corridors);
connectivity itself is always free (at least one connection). Two properties matter:

- **`stitch` operates on the whole level, never `level:bounds`.** By the time it runs, `level:bounds`
  holds only the *last* section's sub-rect (the last-writer-wins slot below). Reading it made `stitch`
  flood one half, mistake the other half's tiles for a separate component, and leave the level
  disconnected. It uses `level.width/height`, with an optional `bounds` param for a future embedded case.
- **Three-plus areas work in one pass** — union-find connects N components regardless of count, guided
  by gap length (a linear A│B│C layout chains A–B–C). The one caveat: `maxConnections` caps *extra*
  connections globally, drawn shortest-first, so with several seams of unequal width the extras pile onto
  the tightest seam. Per-seam control is a deliberate multi-pass (run `stitch` once per seam via its
  `bounds` param); per-seam balancing in a single pass is a documented option, not built — connectivity
  never needs it.

**`level:bounds` is a single, last-writer-wins slot** — "the current section's rect," not a durable map
size. The box establishes the grid; each section overwrites `level:bounds` with its own rect; nothing
may treat it as the map extent (`stitch` was the first to get bitten). A durable "full map" key could be
added if more stages ever need it.

**District population.** Because `appendZones` stamps a `section` on a stage's zones (`bspGeometry`/
`segmentRegions` pass it from config), `label` and `populate` take a `section` filter — so a composed
floor labels and populates each district separately (BSP keep gets orcs, cave gets goblins and
scuttlers) by running those stages once per section. Absent a `section`, both span the whole floor
unchanged. `stairs`/`spawn` find their zone by label, so scoping `label` scopes them too.

**Reserved areas.** A second composition mode: the `reserve` stage publishes `level:reserved` rects that
a *later* stage fills. `caSeed`/`caSmooth` hold those cells wall (the shared `isReserved` predicate in
[`stage-reserve.js`](../../src/world/generation/stages/stage-reserve.js)), so a cave grows around a hole
a BSP section then fills — pipeline `box → reserve → CA → BSP → stitch`. `caBridge` is reserved-aware:
it passes a `blocked` predicate the shared walker won't step onto or carve, **and** skips any bridge
whose straight line crosses a reserved rect. That skip matters — a central hole can split the cave into
arcs, and without it `caBridge` would tunnel a bridge across the hole that the BSP fill then overwrites
in the middle, leaving two dead-end stubs; instead the arcs are left for `stitch` to join to the filled
block. (The walker still can't path-find around a big obstacle; the straight-line skip is what keeps it
honest.) This mode is built and tested; the shipped composite floor uses the side-by-side `bounds`
mode instead.

---

## 7. Shared tail — unchanged

Both pipelines hand off the same thing BSP does. `populate` reads `kind == 'chamber'` (absent ⇒ chamber)
and the zone's room tiles; `stairs`/`spawn` place on `centermostRoomTile`, which prefers the `core`;
`label` assigns roles over the zone set geometry-agnostically. `label`/`populate` additionally take the
optional `section` filter (§6), which is inert when absent — so the tail stays generator-agnostic. If
any of these stages ever branches on generator identity or on `origin`, the abstraction has failed and
the fix belongs in the region fields, not the population stage.

Each stage owns its defaults: it exports a `DEFAULTS` object, and `pipeline.js` derives a
`STAGE_DEFAULTS` registry (and `STAGE_TYPES`) from the stage modules — one source of truth the visualizer
reads (§9).

---

## 8. Performance envelope

Two independent scaling axes that must not be conflated:

- **Chamber count `n`** (the graph work in `layoutEdges`). Even the worst term (an O(n³) crossing test)
  stays instant to ~300 chambers, and `n` is physically capped by map area / min-separation. Brute force
  ships; there is no reachable input where it is the bottleneck.
- **Tile count `T`** (all raster work: carving, CA smoothing, distance transform, flood fill). These are
  O(T) or O(T·k) with small fixed `k`, so a 10× map is a linear 10× cost. The one real trap is an
  accidental **O(T²)** inner loop — a tile loop nested over tiles. The danger zone is `caBridge`'s
  nearest-component search, which is why it bridges centroids, not tiles.

The discipline is a code-review rule — *no tile loop nests over tiles* — enforced by a **deterministic
work-count test** rather than a wall-clock one (a timing assertion is flaky and slows the suite). It
counts tile-grid reads at 1× and 16× tile scale via a read-counting Proxy and asserts the ratio is
roughly linear (≈16×), not quadratic (≈256×). It lives beside `caBridge`
(`stage-ca-bridge.test.js`), the one stage with a real O(T²) trap; the other stages have no super-linear
tile loop to guard. Full reasoning in
[ADR-028](architecture-decision-records/adr.md#adr-028-organic-generation-performance-envelope).

---

## 9. Determinism, the seed contract, and visualization

All randomness comes from the injected `mapgen` rng (ADR-024); `Math.random()` is forbidden.
Segmentation additionally consumes **no** RNG and must be a pure function of geometry (§5).

A seed reproduces a level only in combination with a fixed stage **order** *and* fixed stage
**parameters** — both are the contract. Changing `nodeCount`, `loopFactor`, `wallChance`, `iterations`,
or `prominence` re-rolls existing seeds exactly as reordering stages does, and just as silently. See
[ADR-029](architecture-decision-records/adr.md#adr-029-generation-parameters-are-part-of-the-seed-contract).

### Visualization tooling

Because generation is deterministic and headless, it is cheap to render for inspection. The pure,
DOM-free renderers in [`visualize.js`](../../src/world/generation/visualize.js) take a level/blackboard
and return a string:

- `levelToAscii`, `zonesToText`, `zonesToMermaid` — text and graph views (used by tests and quick
  debugging).
- `levelToHtml` / `mapLegendHtml` — a coloured HTML render: rooms tinted by district (`section`) or
  kind, passages muted, and the game's own entity glyphs overlaid. `MAP_STYLES` is the shared stylesheet.
- `toJsLiteral` / `levelToStaticModule` — a pipeline as a repo-style JS literal, and a generated level as
  a hand-editable `data/maps/*.js` static layout.

Two tools consume the same `levelToHtml`, so they can't drift:

- **The CLI**, `scripts/visualize-generation.mjs` (`npm run visualize -- <pipelineId> <seeds>`) — runs a
  pipeline over N seeds and writes a self-contained HTML grid of example maps.
- **The page**, [`map-visualizer.html`](../../map-visualizer.html) — a standalone dev page (like the
  sprite finder) to edit a pipeline, load an existing one, append a stage from `STAGE_DEFAULTS`, generate
  several seeds, copy the pipeline, and export a floor as a static layout.

See [visualizing-generation.md](../howto/visualizing-generation.md). The pipeline runner exposes an
`onStageComplete(stageType, level)` hook — a seam a future stage-by-stage scrubber can snapshot through.

---

## 10. Deferred and future

- **`junction` kind** — reserved in the region model (§2) but not produced by any stage yet; CA
  segmentation currently emits only `chamber` and `passage`.
- **Walker in composition.** `carveChambers`/`carveCorridors` couple zone id to `node.id`
  (`carveCorridors` resolves target tiles and writes links by node id), so the walker isn't
  append-safe and stays single-section. A coordinated change when a composed floor wants a walker wing.
- **District *containment*** — the `section`-scoped label/population mechanism is built (§6); what's
  deferred is *geometric* containment of a walker's corridors to its own cluster (a flooded quarter that
  stays home). A content feature; no architecture needed until a concrete level wants it.
- **Stage-by-stage scrubber / overlay layers** in the visualizer — the `onStageComplete` seam is in
  place (§9); the interactive scrubber and toggleable blackboard overlays are not built.
- **Score-and-reject** — generate/measure/reroll if output quality proves inconsistent. Changes what a
  seed means (it becomes "the first acceptable roll"), same hazard class as stage order; don't add it
  casually. The segmenter is the scorer if it is ever done.
- **Delaunay layout / Lloyd's relaxation** — the `level:edges` and `layoutNodes` seams exist; swap in if
  a level ever wants hundreds of nodes or a clumpy→regular dial. Brute force + dart-throwing are the
  defaults until then.
