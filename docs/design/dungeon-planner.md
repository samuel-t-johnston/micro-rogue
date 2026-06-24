# Dungeon Planner — Multi-Floor Coordination

Purpose: how individual generated levels are tied into a whole dungeon — which levels exist, how
they connect, and how the player moves between them. Builds on the pipeline model in
[map-generation.md](map-generation.md) and the per-level identity in
[rng-and-determinism.md](rng-and-determinism.md).

> **As-built status.** The **minimal** version of everything below is implemented (M5): a linear
> 3-floor stack, cold storage, and tap-to-travel. The **general** model (named-port contracts,
> capability validation, branching, a transit-map visualizer) is **designed here but not built** —
> consistent with map-generation.md's "grow into, not built upfront." Sections are marked
> **[built]** or **[future]**.

---

## The problem

A pipeline produces **one** level for a given `(branch, depth)`; it never decides which levels
exist or how they connect — that's deliberately
[protected design space](procedural-3x3-dungeon.md). Something above the pipeline has to: assign
each level its identity, place the player between levels, freeze levels the player leaves, and wire
each level's stairs/pits to the right destination. That coordinator is the **dungeon planner**.

The hard part is tying an abstract dungeon shape to concrete levels built by varied pipelines. The
answer is to make the connection points a **contract** the pipeline declares, and the dungeon shape
a **transit map** the planner validates against that contract.

---

## Vocabulary

- **Node** — one level in the dungeon, identified by a stable id and a `(branch, depth)` that seeds
  its generation. A node names the pipeline that builds it.
- **Port** — a named connection point on a node (e.g. `up`, `down`, `pit`). Realized in the level
  as a `transition` entity (stairs, a pit) carrying that port name.
- **Edge** — a connection between two ports, with a direction.
- **Transit map** — the full graph of nodes and edges. The planner's source of truth.
- **Contract** — the set of ports a pipeline exposes, with each port's capabilities.

---

## Directionality vs. capability — keep them separate **[future]**

The intuitive labels ("stairs-up is bidirectional incoming, a pit is one-way outgoing") conflate two
independent things. On a **bidirectional** edge, *every* endpoint is simultaneously an exit (you
leave through it) and an arrival point (you come back to it) — so "incoming/outgoing" is a property
of the port's *role in a specific edge*, not of the port itself. Model them apart:

- **Direction lives on the edge:** `bidi` (traversable both ways) or `uni A→B` (one way).
- **Capability lives on the port:** `canExit` (may host a trigger) and `canEnter` (may host an
  arrival). Stairs = both. A pit's top = exit-only; its landing = enter-only.

**Validation rule:** every edge endpoint must use a capability the port actually has. A `uni` edge
whose destination port is exit-only (you can't arrive there) is a configuration error.

This is why a pit reads as "one-way out": it is the source of a `uni` edge whose sink can only be
entered — not an intrinsic "outgoing" flag.

---

## The connection contract **[future]**

Each pipeline declares, as **static data**, the ports it exposes and their capabilities. Two reasons
the contract must be static rather than discovered by running the pipeline:

1. **Lazy generation.** Levels generate on demand from a seed; the planner can't run every pipeline
   at startup to count transition points — that defeats laziness and burns the mapgen RNG.
2. **Fail-fast.** The planner validates the transit map against the contracts at **app startup and
   unit-test time**, with no level generated.

A static contract can drift from what a stage actually places. Close the gap with a **per-pipeline
generation test**: run the pipeline once and assert the realized `transition` ports match the
declared contract. (Stage tests already run procedural pipelines headlessly.)

Because the number of transition points a pipeline produces depends on its **configuration** (the
`label` stage's `labels`, etc.), the contract is declared on the **pipeline config / node**, not on
a stage *type* — a `stairs` stage can't know in the abstract how many stairs it will place.

---

## The transit map **[built, minimal]**

Plain data (`data/transit-map.js`), so the planner, the validator, and any visualizer all read it
the same way. Minimal shape:

```js
{
  start: { node: 'floor-1', port: 'up' },
  nodes: [ { id, pipelineId, branch, depth }, … ],
  edges: [ { a: [node, port], b: [node, port], dir: 'bidi' | 'uni' }, … ],
}
```

- **Node identity = `(branch, depth)`**, used as both the mapgen seed-mix *and* the cold-storage
  key. Node ids must be unique.
- A `uni` edge is traversable only from `a` to `b`.
- Authoring is a hand-written data object. A **builder** helper could come later if large graphs get
  painful, but the validated artifact stays plain data.

Resolution (`resolveDestination(map, node, port)`) returns the destination `{ node, port }` or null
(the top/bottom of the dungeon, or the wrong end of a one-way edge). See
[`src/world/dungeon/transit-map.js`](../../src/world/dungeon/transit-map.js).

---

## The travel operation **[built]**

When the player activates a transition (tap-to-interact on stairs — see Trigger), the level manager
([`src/world/dungeon/level-manager.js`](../../src/world/dungeon/level-manager.js)):

1. **Limbo** — collects the player's whole entity sub-graph (carried + equipped items) via
   [`collectSubgraph`](../../src/world/dungeon/subgraph.js), so it travels with the player instead
   of being frozen.
2. **Freeze** — serializes the current floor (and its entities, minus limbo) into a cold-storage
   blob and **removes those entities from the registry** (see Cold storage / model b).
3. **Generate or thaw** — if the destination is in cold storage, thaw it; otherwise generate it from
   its node identity (`derive('mapgen', branch, depth)`).
4. **Arrive** — place the player sub-graph at the destination's arrival port (the stairs entity whose
   `port` matches — you land on the stair you'd take back).
5. **Save** — once the new floor is settled.

---

## Cold storage — runtime model (b) **[built]**

Only the **active** floor's entities ever live in the entity registry. Freezing serializes a floor's
entities out to a blob and drops them from the registry; thawing restores them. This keeps the
registry-global turn manager and sense systems (which iterate `registry.getEntitiesWith(...)`)
working unchanged — they always see exactly one floor + the player. The alternative (all floors live
in one registry) would require retrofitting level-scoping into every system; we **absorb** the cost
at the transition boundary instead.

Consequence for the save: the top-level `entities` list is the active floor + player only; each
frozen floor carries its **own** serialized entities inside its blob. This diverges from the
original single-flat-list model in [save-system-design.md](save-system-design.md) (documented there
as as-built). Entity ids stay globally unique because `nextEntityId` is monotonic and saved.

---

## Trigger **[built]**

Tap-to-interact: tapping the tile you're standing on, when it holds a `transition` entity, requests
the travel (via a `level.onTransition` hook the scene wires, mirroring `level.onPlayerDeath`). The
action only *requests*; the game scene performs the swap (it must rebuild the action system, turn
loop, senses, and camera) on a deferred macrotask, after the in-flight turn unwinds.

Tap was chosen over **step-on** to avoid the **arrival-bounce**: on a bidirectional edge you arrive
*standing on* the destination stair, so a step-on trigger would immediately fire again. Step-on
remains possible later with an "arm only after stepping off and back on" guard.

---

## Visualizer **[future]**

A dev tool to render the transit map as Mermaid / ASCII (nodes, ports, edge directions), mirroring
the generation [filmstrip visualizer](../howto/visualizing-generation.md). Validates the dungeon
shape at a glance and documents branches.

---

## What the minimal cut ships vs. defers

| Capability | Status |
|---|---|
| Linear multi-floor stack, distinct pipeline per floor | **built** |
| Cold storage (model b), limbo, freeze/thaw | **built** |
| Named ports (`up`/`down`) on transitions | **built** |
| Tap-to-travel trigger | **built** |
| Save integration (frozen floors, current node, migration v3) | **built** |
| Exit/enter **capabilities** + contract **validation** | future |
| Branching graphs, `uni` edges (pits/chutes) in real content | future (resolver supports `uni`) |
| Transit-map **visualizer** | future |
| Per-floor persistent fog-of-war memory (revisiting shows your old map) | **built** — `travel()` freezes the player's remembered tiles + furniture into the departed floor's cold-storage record and restores the destination's; a never-visited floor starts dark |
| Re-entry pipelines (simulate time on revisit) | future — see map-generation.md |

---

## Relevant files

- Transit map data — [`data/transit-map.js`](../../data/transit-map.js)
- Resolution + node lookup — [`src/world/dungeon/transit-map.js`](../../src/world/dungeon/transit-map.js)
- Dungeon runtime (travel, cold storage, current node) — [`src/world/dungeon/level-manager.js`](../../src/world/dungeon/level-manager.js)
- Freeze/thaw — [`src/world/dungeon/cold-storage.js`](../../src/world/dungeon/cold-storage.js)
- Sub-graph closure — [`src/world/dungeon/subgraph.js`](../../src/world/dungeon/subgraph.js)
- Pipeline registry — [`src/world/dungeon/pipelines.js`](../../src/world/dungeon/pipelines.js)
- Trigger — [`src/actions/action-types/action-self-interact.js`](../../src/actions/action-types/action-self-interact.js)
- Arrival placement — [`src/world/map/spawn.js`](../../src/world/map/spawn.js) (`resolveArrival`)
- Scene orchestration — [`src/ui/scenes/game-scene.js`](../../src/ui/scenes/game-scene.js) (`mountLevel`, `performTransition`)
