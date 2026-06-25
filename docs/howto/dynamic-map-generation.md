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
    { type: 'spawn' },
    { type: 'populate' },
  ],
};
```

The runner [`runPipeline`](../../src/world/generation/pipeline.js) creates a fresh level and runs each stage in order, looking the stage function up by `type` in the `STAGES` registry:

```js
run(level, stageConfig, blackboard, rng, registry)
```

Every stage gets the same five arguments. They communicate through the shared **`blackboard`** (`level.blackboard`) — early planner stages write a structure, later stages read it. The runner also stamps the level's `identity` (`branch`, `depth`, `pipelineId`, and the rng's derived `seed`) so a frozen floor carries everything needed to regenerate it.

### The two stage families

The shipped procedural pipeline splits cleanly:

1. **Planner** — `roomGridGeometry` → `label` → `link` build an abstract zone graph in the blackboard (rooms, their labels, the connections between them). No tiles yet.
2. **Realization** — `carveRooms` → `carveHalls` turn that graph into actual floor/wall tiles, then `stairs`, `spawn`, and `populate` place exits, the player's arrival mark, and contents.

Static pipelines use a different, shorter set (`static` / `randomStatic` to lay down a fixed layout, `placeStaticEntities` to instantiate authored entities) — see [static-map-layouts.md](static-map-layouts.md). The registry holds both families; a pipeline mixes whatever stages it needs.

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
