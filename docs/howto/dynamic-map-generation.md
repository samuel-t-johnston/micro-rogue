# Dynamic Map Generation

*How a floor is built from a pipeline of stages, and how to add a stage or a pipeline. For the inter-floor side — which floors exist and how they connect — see [dungeon-layout.md](dungeon-layout.md). For authoring fixed layouts, see [static-map-layouts.md](static-map-layouts.md). Design rationale lives in [map-generation.md](../design/map-generation.md) and [procedural-3x3-dungeon.md](../design/procedural-3x3-dungeon.md).*

## How it works

A **pipeline** is plain data: an id plus an ordered list of stage configs (see [`data/pipelines/`](../../data/pipelines)).

```js
// data/pipelines/procedural-3x3.js
export default {
  id: 'procedural-3x3',
  stages: [
    { type: 'roomGridGeometry' },
    { type: 'label', labels: ['stairs-up', 'stairs-down', 'treasure', 'item', 'item', 'amulet'] },
    { type: 'link' },
    { type: 'carveRooms' },
    { type: 'carveHalls' },
    { type: 'stairs' },
    { type: 'populate', creatures: [/* which creatures spawn + room-affinity weights */] },
    { type: 'scaleCreatures', levels: { goblin: 3, orc: 3, scuttler: 3, orcCommander: 3 } },
    { type: 'loadout' },
  ],
};
```

(The `populate` roster is elided here — see [`data/pipelines/procedural-3x3.js`](../../data/pipelines/procedural-3x3.js) for the full config.)

The runner [`runPipeline`](../../src/world/generation/pipeline.js) creates a fresh level and runs each stage in order, looking the stage function up by `type` in the `STAGES` registry:

```js
run(level, stageConfig, blackboard, rng, registry)
```

Every stage gets the same five arguments. They communicate through the shared **`blackboard`** (`level.blackboard`) — early planner stages write a structure, later stages read it. The runner also stamps the level's `identity` (`branch`, `depth`, `pipelineId`, and the rng's derived `seed`) so a frozen floor carries everything needed to regenerate it.

### The two stage families

The shipped procedural pipeline splits cleanly:

1. **Planner** — `roomGridGeometry` → `label` → `link` build an abstract zone graph in the blackboard (rooms, their labels, the connections between them). No tiles yet.
2. **Realization** — `carveRooms` → `carveHalls` turn that graph into actual floor/wall tiles, then `stairs` and `populate` place exits and contents; finally `scaleCreatures` levels the placed monsters for depth and `loadout` arms them from item tables. The player arrives standing on the up-stair (`resolveArrival`), so no separate arrival marker is placed.

Static pipelines use a different, shorter set (`static` / `randomStatic` to lay down a fixed layout, `placeStaticEntities` to instantiate authored entities) — see [static-map-layouts.md](static-map-layouts.md). The registry holds both families; a pipeline mixes whatever stages it needs.

### Theming with the palette stage

Carve stages don't hard-code tile ids — they lay down whatever `{ floor, wall }` **palette** is in scope. The `palette` stage sets it, and it's sticky (holds until the next `palette` stage), so a pipeline themes a run by interleaving one: `{ type: 'palette', floor: 'cave-floor', wall: 'cave-wall' }` before the CA stages makes them carve a cave instead of stone. A composed level can set a different palette per section. Absent, generation defaults to stone. See [tile-types.md § Terrain palettes](tile-types.md#terrain-palettes).

### Line walls (CP437 double-line rendering)

The `lineWalls` stage is a late, purely-cosmetic pass: it rewrites each wall tile to the double-line box-drawing variant (║ ╣ ╬ …) matching which of its four cardinal neighbours are walls, so glyph mode draws connected walls instead of a field of `#`. Add `{ type: 'lineWalls' }` after every tile-writing stage. It's glyph-only — variants reuse their base wall's sprite, so sprite mode is unchanged — and gameplay-neutral, since variants keep the base's category, passability, and opacity. Any wall-category tile counts as a connecting neighbour (stone and cave walls join at a boundary); the grid edge counts as empty, so a wall on the border closes into a clean box outline; and an isolated wall (no wall neighbour) keeps its plain glyph. See [tile-types.md § Line walls](tile-types.md#line-walls) and [`data/tiles/line-walls.js`](../../data/tiles/line-walls.js).

### Secret doors and rooms

Two optional stages hide content behind walls a player must **search** to reveal (see [secret-doors-and-search.md](../design/secret-doors-and-search.md) for how the disguise and search work). Both place a wall-disguised entity, so run them **after all tile-writing/door stages and before `lineWalls`**, so the affected tiles join the box-drawing mask.

- **`secretDoors`** turns existing closed doors into secret doors. `{ type: 'secretDoors', chance, scope, bounds? }`:
  - `chance` (0..1, default 0 — a no-op) is the per-door probability.
  - `scope` is `'redundant'` (default — hides only doors on a loop, so a searchless path always remains) or `'all'` (may seal a sole-access door, gating a region behind a search). Redundancy is computed structurally, so it never disconnects the level.
  - `bounds` restricts which doors are eligible (e.g. one district); redundancy is still judged over the whole map.
  - Shipped on `procedural-3x3` (`floor-3`) at `scope: 'all', chance: 0.2`.
- **`secretRoom`** carves a small treasure room from solid rock, entered only through a secret door. `{ type: 'secretRoom', count?, contents?, bounds? }`: `count` rooms (default 1, non-overlapping), `contents` chest loot as prefab ids (default a healing potion + bread), `bounds` to scope it. It needs a 3×3 rock footprint against a wall with floor beyond; if none fits, it places nothing. Shipped on `composite` (the branch's bottom floor).

### Determinism

All randomness comes from the `rng` the runner is handed — the dungeon runtime derives a dedicated per-floor `mapgen` stream from the floor's identity (see [rng-and-determinism.md](../design/rng-and-determinism.md)), so the same seed always yields the same floor, independent of gameplay rolls.

## Add a stage

1. Write `export function run(level, config, blackboard, rng, registry) { … }` in [`src/world/generation/stages/`](../../src/world/generation/stages). Read your inputs from the blackboard (and `config` for parameters), write your outputs back to it or onto the level. Each stage has clear inputs/outputs, so it's [test-first](../../AGENTS.md) — every shipped stage has a `*.test.js` beside it.
2. Register it in the `STAGES` map in [`pipeline.js`](../../src/world/generation/pipeline.js): `myStage: runMyStage`.
3. Reference it by `type` from any pipeline config.

## Add a pipeline

1. Create a descriptor in `data/pipelines/` with a unique `id` and a `stages` list.
2. Register it so a transit map can name it — see [dungeon-layout.md](dungeon-layout.md) (the pipeline registry).

## Watch it build

`runPipeline` takes an optional `onStageComplete(stageType, level)` callback — a debug seam that snapshots the level after each stage without stages knowing about it. The generation visualizer uses it; see [visualizing-generation.md](visualizing-generation.md).

## See also

- [Dungeon layout](dungeon-layout.md) — wiring floors together (transit map + pipeline registry).
- [Static map layouts](static-map-layouts.md) — authoring fixed floors.
- [Tile types](tile-types.md) — the tiles stages write.
