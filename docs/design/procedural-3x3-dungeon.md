# Procedural 3×3 Dungeon — Working Document

Purpose: the design and step-by-step build plan for ROGµE's first procedural level — a Rogue-style
3×3 room grid with twists. This is a **living document**: update the status column as slices land so
the work is easy to resume from a fresh context. It builds on the pipeline model in
[map-generation.md](map-generation.md) and the RNG model in
[rng-and-determinism.md](rng-and-determinism.md).

## Overview

A classic Rogue 3×3 grid of rooms, with: one cell deleted and two merged (irregular footprint),
labelled rooms (stairs, treasure, item), a connectivity-guaranteed link graph, carved rooms +
corridors, and label-driven population. The generator produces **one level** for a given
`(branch, depth)`; it never decides which levels exist or how they connect — that's a future
coordinator's job (see Protected Design Space).

## Settled decisions (the "why")

- **Plan, then realize.** The zone/link/label graph is an abstract plan held in the **blackboard**,
  built by *planning* stages (pure data transforms, unit-tested). Separate *realization* stages turn
  the plan into tiles/entities (verified visually). The bug-prone logic is the testable part.
- **Connectivity by construction.** The link stage builds a random **spanning tree** over the zone
  adjacency graph (always connected on a 3×3-minus-one), then adds extra links for loops. No separate
  "repair" pass.
- **Degree is a soft target, not a hard cap.** Aiming for ~1–2 links per room, but connectivity
  wins — the occasional degree-3 junction is allowed (a hard cap of 2 would require a Hamiltonian
  path, which need not exist).
- **Geometry / label / link are separate stages.** Only `room-grid-geometry` knows it's a grid (and
  it's parameterized by `cols`/`rows`/`cellSize`); `label` and `link` operate on any zone set +
  adjacency, so they're reusable for other dungeon shapes.
- **Spawn and stairs are components, not level fields.** `entryPoint` marks where the player arrives;
  `transition` marks a level exit with a coordinator-fillable destination. See New Components.
- **Affinity = weights, in the populator.** Labels carry spawn-weight multipliers (aversion = <1);
  weights live in the population stage's spawn table, not on creature entities.
- **`stage-static` stays.** The procedural pipeline is a *new config*, not a replacement; static
  remains a valid stage (a future level 1, or reconnected when transitions exist).
- **Irregular (polyomino) rooms are allowed (option B).** Merges can grow a zone past two cells into
  L/T/blob shapes. The planner handles this safely; the cost is paid in carving, which must be
  **cell-based, not rectangle-based**: carve from a zone's actual cells and open the walls between
  same-zone cells. **Never carve a zone's bounding box** — for a non-rectangular zone the box covers
  cells it doesn't own (deleted space or a neighbor), so a box-carve produces overlapping rooms.
- **Deletion is connectivity-preserving.** `room-grid-geometry` only removes cells whose removal keeps
  the survivors connected, so multiple deletes can't isolate a room or split the graph — the link
  stage's spanning tree always has a connected graph to work with.

## Concepts & blackboard schema

- **Zone** — a map area made of one or more grid **cells**, with an id and labels. Cells let a single
  zone span a merged region today, and could later differentiate sections of a large room or cave.
- **Link** — a connection between two zones, with an id.
- **Label** — a string marking a zone or link (`room`, `stairs-up`, `stairs-down`, `treasure`,
  `item`, …). Convention over the free-form blackboard.
- **Affinity / aversion** — per-label spawn-weight up/down for a populated entity type.

Proposed shapes (in [`level.blackboard`](../../src/world/level.js)):

```js
blackboard['level:zones'] = [
  { id: 0, cells: [[0,0]], rect: { x, y, w, h }, labels: ['room', 'stairs-up'] },
  { id: 1, cells: [[1,0],[2,0]], rect: { … }, labels: ['room'] }, // a merged zone
  // …
];
blackboard['level:adjacency'] = [[0,1], [1,2], …]; // zone-id pairs sharing an edge
blackboard['level:links'] = [ { id: 0, a: 0, b: 1 }, … ];
```

`rect` is the zone's grid bounds (derived from its cells); carved room geometry is computed later from
it. Stages iterate zones/links in **id order** so the `derive('mapgen', branch, depth)` stream
produces stable results.

## New components

Added to [`src/world/components.js`](../../src/world/components.js):

- **`transition({ to = null })`** — marks a furniture entity (stairs now; pits, etc. later) as a level
  exit. `to` is the destination — left **null** by the generator and filled in by a future
  coordinator (`{ branch, depth, entry }` or a level id). The trigger mechanism (step-on vs tap) is
  deferred until transitions are wired.
- **`entryPoint()`** — tags the entity (with a `position`) where the player arrives.
  [`game-scene`](../../src/ui/game-scene.js) places the player via `getEntitiesWith('entryPoint')`
  instead of the level center; if more than one, pick one (and log). Normally placed on the
  `stairs-up` entity, but kept separate so pit-arrivals / multi-entry levels can mark other spots.

## Build plan

Planning stages (1–3) are pure blackboard transforms with no game-runtime impact — build and test them
first. The first *playable* checkpoint is step 6.

| # | Slice | What it does | Reads → Writes | Tests | New / changed files | Status |
|---|---|---|---|---|---|---|
| 1 | `room-grid-geometry` stage | Grid of rooms (params: `cols`/`rows`/`cellSize`/`deletes`/`merges`/`minZones`, default 3×3×10, 1 delete, 1 merge); connectivity-preserving deletes; merge adjacent groups into polyomino zones; compute adjacency | rng → `level:grid`, `level:zones`, `level:adjacency` | unit: zone/cell counts, rects, adjacency+connectivity across multi-delete, polyomino growth, minZones cap, params, determinism | `stages/stage-room-grid-geometry.js`, register in `pipeline.js` (type `roomGridGeometry`) | **Done** |
| 2 | `label` stage | Label distinct random zones (default stairs-up, stairs-down, treasure, item, item; `labels` param), drawn without replacement; geometry-agnostic; skips trailing labels if short | `level:zones` → zone `labels` | unit: multiplicities, 5 distinct zones keep base `room`, custom labels, too-few-zones warning, determinism | `stages/stage-label.js`, register in `pipeline.js` (type `label`) | **Done** |
| 3 | `link` stage | Random spanning tree (connectivity by construction) + soft-cap-limited extra links (`extraLinkChance`/`maxExtraDegree` params); links ⊆ adjacency | `level:zones`/`adjacency` → `level:links` | unit: spanning-tree-only, all-edges, ids/order, connectivity over 30 real layouts, soft-cap limits extras, determinism | `stages/stage-link.js`, register in `pipeline.js` (type `link`) | **Done** |
| 4 | Visualization / debug tooling | Headless dev tool (`npm run visualize -- [runs] [seed] [out]`): runs a pipeline N times, writes a markdown report — config, timestamp, seeds, and a per-run **filmstrip** (snapshot after each stage). Renderers: `levelToAscii` (map), `zonesToText` + `zonesToMermaid` (topology). Pipeline gained an optional `onStageComplete` hook | level/blackboard → markdown file | unit: `levelToAscii`/`zonesToText`/`zonesToMermaid` (pure) + `onStageComplete` hook; tool run manually | `scripts/visualize-generation.mjs`, `src/world/generation/visualize.js`, `pipeline.js` hook, `docs/howto/visualizing-generation.md` | **Done** |
| 5 | Spawn/exit components | Added `transition({to})` + `entryPoint()`; `createStairs` furniture; `resolveSpawn` reads the entryPoint and `game-scene` places the player there; static level drops an inert up-stairs + entryPoint at its centre (preserves the old start) | — | unit: `resolveSpawn` (position / center fallback / multi-entry guard) + component shapes; rest visual | `components.js`, `furniture.js`, `world/spawn.js`, `game-scene.js`, `stage-place-test-entities.js` | **Done** |
| 6 | `carve-rooms` + config + `spawn` | `carveRooms` inits the wall grid and **carves per cell** (actual cells, same-zone seams opened, 1-tile gutters to other zones — never the bounding box; max-size rooms for now, variety deferred); `spawn` drops an `entryPoint` in the stairs-up room; `procedural-3x3` config; `game-scene` points at it; viz default updated. First playable (islands, no halls) | `level:zones`/`labels` → tiles, entryPoint entity | unit: level size, wall border, **one floor component per zone** (seams open + gutters separate) over 20 seeds, determinism; spawn on stairs-up floor; visual via viz | `stages/stage-carve-rooms.js`, `stages/stage-spawn.js`, `data/pipelines/procedural-3x3.js`, `game-scene.js`, `scripts/visualize-generation.mjs` | **Done** |
| 7 | `carve-halls` stage | For each link, carve a straight cut through the 2-tile gutter at a non-corner shared offset + drop one door at the opening (dog-leg/longer routing deferred with room-size variety) | `level:links` + room tiles → floor tiles, door entities | unit: **single floor component** over 20 seeds (all rooms connected), one door/link on floor, determinism; visual | `stages/stage-carve-halls.js`, `data/pipelines/procedural-3x3.js`, viz | **Done** |
| 8 | `stairs` stage | Place up/down stairs furniture (`createStairs`, `transition{to:null}`) at the centre floor of the labelled rooms; shares `zone-tiles.js` (centermostFloor) with spawn | `level:zones`/`labels` → entities | unit: one up + one down on floor in their zones, inert transition, determinism; `zone-tiles` helper | `stages/stage-stairs.js`, `world/generation/zone-tiles.js`, `stage-spawn.js` (refactor), config+viz | **Done** |
| 9 | `populate` + items | Treasure rooms: chest (1–2 items) + 0–1 floor items; item rooms: 1 floor item; orcs (affinity weights treasure/item) and goblins (aversion, separate rooms); never on the stairs-up room, nothing stacked (~3–5 items/level). New items: sword, leather armor, scroll | `level:zones`/`labels` → entities | unit: `weightedPick`, chest counts, creature counts/separation/on-floor/not-on-stairs-up, orc-vs-goblin affinity tendency, determinism; new-item shapes | `stages/stage-populate.js`, `items.js` | **Done** |
| 10 | Room variety + dog-leg halls (revises 6 & 7) | carve-rooms: per-cell **random** rooms (2×2 floor min → 8×8 max) joined within a zone by grow-to-touch (no intra-zone halls); carve-halls: random non-corner opening on each room's facing wall, **door on both sides**, straight or **Z-bend** corridor through the wider gutter, collisions tolerated. Per-cell room rects recorded in `level:rooms` | `level:zones`/`links` → tiles, doors, `level:rooms` | unit: one floor component per zone (incl. merges), room-rect min size, size variety, whole-level single component, two doors/link, determinism; visual | `stage-carve-rooms.js`, `stage-carve-halls.js` | **Done** |

### Visualization & debug tooling (step 4)

A standalone, **dev-only** tool, decoupled from the running game (no canvas, no game scene — it builds
a level headlessly, the way the save tests do). The dev supplies a pipeline config (or a single stage)
+ a run count (+ optional fixed seeds); it runs them and writes a **markdown report**:

- **Header** — the pipeline/stage config + params, a timestamp, the run count, and the seeds used (so
  any run is reproducible).
- **Per run, a "filmstrip"** — a snapshot after *each* stage, showing the level evolve:
  - the **spatial map** via `levelToAscii(level)` (`#` wall, `.` floor, `+` door, label letters) — text,
    since Mermaid can't place tiles on a grid;
  - the **topology** (zones + labels + links/adjacency) as a text edge-list, with an optional Mermaid
    graph block (topologically faithful, not spatially).

`levelToAscii` and the topology renderer are pure functions (unit-testable); the report writer + CLI
are the tool. The pipeline gains an optional `onStageComplete(stageName, level)` hook so snapshots are
captured without stages knowing about it.

**Timing (my call):** slotted at step 4 — after the planner, so the topology view immediately validates
`label`/`link`, and before carving, so the map view is ready to eyeball the carve stages as we build
them (it just renders an all-wall grid until tiles exist).

### Room variety & dog-leg halls (step 10)

Revises the realization stages from steps 6–7: rooms become randomly sized/placed, and halls bend.

**carve-rooms — per-cell random rooms, grown to touch within a zone.**
- For every cell, carve a random floor rectangle: **2×2 floor min**, up to the cell interior (8×8 at
  cellSize 10), at a random offset. Each room keeps its ≥1-tile gutter on sides facing a *different*
  zone or the grid edge, so adjacent zones stay ≥2 tiles apart.
- For each **same-zone seam** (two adjacent cells of one zone), join the rooms with **no corridor**:
  1. extend both rooms' seam-facing edges to the cell boundary;
  2. if their perpendicular extents still don't overlap, grow one/both *perpendicular* to the seam
     (staying inside the cell interior) until they overlap by ≥1;
  3. open the wall across the full overlap (a wide doorway).
  Always terminates — same-zone cells share the whole perpendicular band, so an overlap is always
  reachable in-bounds. Merged zones read as one open joined room (fat rect / L / plus), never "two
  rooms on a thread." L/T zones (merges>1) fall out: handle each seam independently; growing a room
  for two seams just enlarges it in two directions.
- Record each cell's room rectangle to `level:rooms` (keyed by `"c,r"`) for the hall stage.

**carve-halls — doored Z-bend corridors between linked zones.**
- Per link, pick an adjacent cell-pair + direction. On each room's wall facing the other, pick a
  random **non-corner** opening and place a **door on both** sides.
- Route between the openings: straight if aligned, else a **Z-bend** (out across the wider gutter,
  along, in). Collisions tolerated — floor-over-wall is harmless, crossing a hall merges, a clipped
  corner just widens an opening; connectivity is unaffected.

**Invariants to keep:** one floor component per zone (carve-rooms, including merges); a single floor
component for the whole level (carve-halls); two doors per link; determinism.

**Placement (stairs/spawn/populate):** these place entities only within zone **room rectangles**
(`level:rooms`, via `roomTiles`/`centermostRoomTile`), **not** raw cell floor — otherwise corridor and
door tiles (also `floor`, also inside a cell) get picked, landing entities in hallways or on doors.
Populate additionally skips tiles already holding an entity (checked through the spatial index), so
furniture/creatures never stack on stairs, doors, the entry point, or each other.

## Protected design space (future coordinator)

Not building it yet, but holding these so it stays buildable:

- **`(branch, depth)` is an input to generation, never decided by it** — the coordinator assigns it
  and threads it into `derive('mapgen', branch, depth)`.
- **`transition.to` stays nullable and coordinator-fillable** — the generator places unwired stairs;
  pairing them across floors is coordinator policy.
- **No stage sees more than one level** — no cross-floor assumptions anywhere in the pipeline.

## Deferred / open

- Level-transition **trigger** (step-on vs tap-to-interact) — decided when transitions are wired.
- The **coordinator** itself (multi-floor shape, branching, cross-floor stair/pit pairing).
- **Re-entry pipelines** (map-generation.md, Speculative) — simulating time on level reload.
- A debug **zone/graph overlay** for inspecting the plan — nice-to-have for steps 1–3.

## Relevant files

- Pipeline runner + stage registry — [`src/world/generation/pipeline.js`](../../src/world/generation/pipeline.js)
- Existing stages (kept) — [`stage-static.js`](../../src/world/generation/stages/stage-static.js); static layouts place their authored entities via [`stage-place-static-entities.js`](../../src/world/generation/stages/stage-place-static-entities.js) (replaced the dev-only `stage-place-test-entities.js`)
- Level model (tiles, blackboard, placeEntity, isPassable) — [`src/world/level.js`](../../src/world/level.js)
- Components — [`src/world/components.js`](../../src/world/components.js)
- Furniture / items / creatures — [`furniture.js`](../../src/world/furniture.js), [`items.js`](../../src/world/items.js), [`creatures.js`](../../src/world/creatures.js)
- Tiles & equipment slots — [`data/tiles/terrain.js`](../../data/tiles/terrain.js), [`data/equipment-slots.js`](../../data/equipment-slots.js)
- Generation RNG — [`src/engine/rng.js`](../../src/engine/rng.js) (`rng.deriveRng('mapgen', branch, depth)`)
- Pipeline invocation + player placement — [`src/ui/game-scene.js`](../../src/ui/game-scene.js)
- Pipeline configs — [`data/pipelines/`](../../data/pipelines/static-test-level.js)
- Design — [map-generation.md](map-generation.md), [rng-and-determinism.md](rng-and-determinism.md)
