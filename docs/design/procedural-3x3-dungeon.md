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
| 2 | `label` stage | Label 5 random zones: stairs-up, stairs-down, treasure, item, item (geometry-agnostic) | `level:zones` → zone `labels` | unit: each label placed once on a real zone; determinism | `stages/stage-label.js` | Not started |
| 3 | `link` stage | Random spanning tree + extra links toward a soft degree target | `level:zones`/`adjacency` → `level:links` | unit: single connected component; degree distribution; determinism | `stages/stage-link.js` | Not started |
| 4 | Visualization / debug tooling | Headless dev tool: plug in a pipeline (or single stage) + run count (+ optional seeds); writes a markdown report with config, timestamp, seeds, and a per-run **filmstrip** (a snapshot after each stage). Renderers: `levelToAscii` (spatial map) + a text topology view (Mermaid optional, not spatially faithful). Pipeline gains an optional `onStageComplete` hook | level/blackboard → markdown file | unit: `levelToAscii` + topology renderers (pure); tool run manually | `scripts/visualize-generation.mjs`, `src/world/generation/visualize.js`, optional hook in `pipeline.js` | Not started |
| 5 | Spawn/exit components | Add `transition` + `entryPoint`; `game-scene` spawns at `entryPoint`; keep static level working (inert stairs-up + entryPoint at its center) | — | unit: entryPoint selection/guard; rest visual | `components.js`, `game-scene.js`, `furniture.js`, static level / `stage-place-test-entities.js` | Not started |
| 6 | `carve-rooms` + config + `spawn` | New procedural pipeline config; init wall grid; **carve per cell** (a zone's actual cells, opening same-zone seams — never the bounding box), gutters between zones; place `entryPoint` at the stairs-up room. First playable (islands, no halls) | `level:zones`/`labels` → tiles, entryPoint entity | unit: per-cell carve / seam helper; visual | `stages/stage-carve-rooms.js`, `stages/stage-spawn.js`, `data/pipelines/procedural-3x3.js`, `game-scene.js` | Not started |
| 7 | `carve-halls` stage | Corridors in the gutters between linked rooms (1–3 segments); door entities placed on a chosen **shared cell-edge** (handles irregular perimeters) | `level:links` + room tiles → floor tiles, door entities | unit: routing helper if separable; visual | `stages/stage-carve-halls.js` | Not started |
| 8 | `stairs` stage | Place stairs-up/down furniture (renderable + `transition{to:null}`) at labelled rooms | `level:zones`/`labels` → entities | visual | `stages/stage-stairs.js`, `furniture.js` | Not started |
| 9 | `populate` + items | Spawn table with affinity weights: chest (1–3) + 0–2 floor items in treasure rooms; 1–2 in item rooms; 2 orcs (weight treasure/item); 2 goblins (averse, separate rooms). Add items (armor, 2nd weapon, scroll) | `level:zones`/`labels` → entities | unit: weighted selection + room-disjointness; visual | `stages/stage-populate.js`, `items.js`, `creatures.js`, spawn-table data | Not started |

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
- Existing stages (kept) — [`stage-static.js`](../../src/world/generation/stages/stage-static.js), [`stage-place-test-entities.js`](../../src/world/generation/stages/stage-place-test-entities.js)
- Level model (tiles, blackboard, placeEntity, isPassable) — [`src/world/level.js`](../../src/world/level.js)
- Components — [`src/world/components.js`](../../src/world/components.js)
- Furniture / items / creatures — [`furniture.js`](../../src/world/furniture.js), [`items.js`](../../src/world/items.js), [`creatures.js`](../../src/world/creatures.js)
- Tiles & equipment slots — [`data/tiles/terrain.js`](../../data/tiles/terrain.js), [`data/equipment-slots.js`](../../data/equipment-slots.js)
- Generation RNG — [`src/engine/rng.js`](../../src/engine/rng.js) (`rng.deriveRng('mapgen', branch, depth)`)
- Pipeline invocation + player placement — [`src/ui/game-scene.js`](../../src/ui/game-scene.js)
- Pipeline configs — [`data/pipelines/`](../../data/pipelines/static-test-level.js)
- Design — [map-generation.md](map-generation.md), [rng-and-determinism.md](rng-and-determinism.md)
