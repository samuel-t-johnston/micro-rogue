# Dungeon Layout

*How floors are wired into a dungeon: the transit map (which floors exist and how stairs connect them), the pipeline registry, and the runtime that moves the player between floors. For how a single floor is built, see [dynamic-map-generation.md](dynamic-map-generation.md). Design rationale: [dungeon-planner.md](../design/dungeon-planner.md) and [map-generation.md](../design/map-generation.md).*

The dividing line: **the transit map decides topology; a pipeline decides the contents of one floor.** The pipeline never knows where its floor sits in the dungeon, and the transit map never knows what's inside a floor.

## The transit map

[`data/transit-map.js`](../../data/transit-map.js) is plain data describing the whole dungeon graph:

```js
export default {
  start: { node: 'floor-1', port: 'up' },
  nodes: [
    { id: 'floor-1', pipelineId: 'static-test-level', branch: 0, depth: 0 },
    { id: 'floor-2', pipelineId: 'random-static-maze', branch: 0, depth: 1 },
    { id: 'floor-3', pipelineId: 'procedural-3x3',     branch: 0, depth: 2 },
  ],
  edges: [
    { a: ['floor-1', 'down'], b: ['floor-2', 'up'], dir: 'bidi' },
    { a: ['floor-2', 'down'], b: ['floor-3', 'up'], dir: 'bidi' },
  ],
};
```

- **`nodes`** — each floor: its `id`, the `pipelineId` that builds it, and its identity `(branch, depth)`. The identity keys the floor's mapgen RNG stream and its place in cold storage, so a floor regenerates identically.
- **`edges`** — connections between **named ports**. A port (`'up'`/`'down'`) maps to a staircase's direction; `dir: 'bidi'` means the link works both ways. The level manager resolves "the player took the `down` stairs on floor-2" to "arrive at floor-3's `up` port."
- **`start`** — where a new game begins.

The shipped dungeon is a 3-floor main stack (branch 0) plus one side **branch**: a second down-stair in floor-1's start room, port `branch1`, wired to a four-floor branch (branch 1) — a large BSP floor (`branch-1-floor-1`), a walker cave floor (`branch-1-floor-2`), a cellular-automata cave floor (`branch-1-floor-3`), then a composite keep-and-cave floor (`branch-1-floor-4`, a BSP wing + CA wing stitched together), each reached by the previous floor's down-stair. The fuller model (exit/enter capabilities, contract validation) is designed in [dungeon-planner.md](../design/dungeon-planner.md) but not built — today's reader is `transit-map.js` accessors in [`src/world/dungeon/transit-map.js`](../../src/world/dungeon/transit-map.js).

### Branching: more than one stair of the same direction

A floor can have two down-stairs going to different places. Ports are just names, so the trick is giving the second stair a **distinct port** and wiring an edge to it:

- **Procedural floor** — `stairs` stage config picks which stairs to place: `{ type: 'stairs', stairs: [['stairs-up','up'], ['stairs-down','down']] }`. A leaf/branch floor can place only an up-stair with `stairs: [['stairs-up','up']]`.
- **Static floor** — author the extra stair with a `port` in the layout's entities: `{ type: 'stairsDown', x, y, port: 'branch1' }` (see [`data/maps/floor-1-a.js`](../../data/maps/floor-1-a.js)). Same-direction stairs stay visually identical; only the port (and thus the edge) differs.

The down-vs-up log message reads off the stair's `entityTypeId`, not the port, so a `branch1` down-stair still says "descend."

## The pipeline registry

A transit map references pipelines by id; [`src/world/dungeon/pipelines.js`](../../src/world/dungeon/pipelines.js) maps those ids to the actual descriptors in `data/pipelines/`:

```js
const PIPELINES = {
  [staticTestLevel.id]: staticTestLevel,
  [randomStaticMaze.id]: randomStaticMaze,
  [procedural3x3.id]:    procedural3x3,
};
```

`getPipeline(id)` resolves one (and throws on an unknown id). Add a pipeline here to make it referenceable from a transit map. (This mirrors the stage registry in generation — see [dynamic-map-generation.md](dynamic-map-generation.md).)

## The runtime

[`createLevelManager`](../../src/world/dungeon/level-manager.js) is the consumer side — it executes the topology, never decides it. It owns the **active floor** and a **cold storage** map of the frozen inactive ones. Only the active floor's entities live in the registry, so the turn manager and senses always see exactly one floor plus the player.

`travel(player, port)`:

1. Resolves the destination via the transit map; bails if the port leads nowhere (top/bottom of the dungeon).
2. **Freezes** the departing floor — serializes its entities out via [`cold-storage.js`](../../src/world/dungeon/cold-storage.js) and removes them — *excluding* the player's whole sub-graph (carried + equipped items travel with them, never frozen).
3. **Thaws** the destination if previously visited, else **generates** it from its node's pipeline.
4. Carries the player's fog-of-war memory: lifted into the departing floor's frozen record and laid back down on arrival (cold storage stays player-agnostic; this player coupling lives only in the level manager).
5. Lands the player at the destination port.

On save/load the manager's `snapshot()` / `restore()` round-trip the active node id and the frozen floors (see [saving.md](saving.md)).

## Add a floor

1. Register its pipeline in `pipelines.js` (if new).
2. Add a `node` to the transit map with a unique `id`, its `pipelineId`, and a `(branch, depth)`.
3. Add `edges` wiring its ports to neighbors. Done — generation, freezing, and travel all key off the data.

## See also

- [Dynamic map generation](dynamic-map-generation.md) — building one floor (pipeline + stages).
- [Static map layouts](static-map-layouts.md) — authoring a fixed floor.
- [Saving](saving.md) — how frozen floors persist.
