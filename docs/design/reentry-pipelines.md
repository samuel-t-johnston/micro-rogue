# Re-entry Pipelines — Regenerating and Mutating Stored Levels

Purpose: how a level *changes* between the moment the player leaves it and the moment they come
back, without simulating it while they're away. Builds on the pipeline model in
[map-generation.md](map-generation.md), the cold-storage lifecycle and travel operation in
[dungeon-planner.md](dungeon-planner.md), and the per-level determinism contract in
[rng-and-determinism.md](rng-and-determinism.md). Touches the save format in
[save-system-design.md](save-system-design.md).

> **As-built status.** The **regen POC** is built and live: `epoch`/`frozenAtTurn` state plumbing
> (save v12), the re-entry policy registry ([`reentry.js`](../../src/world/dungeon/reentry.js)) with
> `thaw` (default) and `regen`, epoch-keyed regeneration wired into `travel()`, quest-item carry-over,
> and `floor-2` enabled as `reentry: 'regen'` (its maze re-rolls on each return). Sections marked
> **[poc]** are those shipped slices; **[future]** marks the selective-mutation work, which is
> designed here but deliberately deferred until concrete scenarios exist.

---

## The problem

Only the active floor runs. Every other floor is frozen to a serialized blob and thawed unchanged on
return (see [map-generation.md](map-generation.md), "Level Lifecycle and Cold Storage"). That's the
right default — simulating idle floors is expensive and rarely produces interesting play — but "thaw
exactly what I froze" is sometimes the *wrong* answer:

- A level that is meant to **always regenerate** (a shifting maze, a randomized challenge room).
- **Time passing** while the player was elsewhere — creatures redistributing, perishables rotting,
  scent trails decaying ([scent-and-smell.md](scent-and-smell.md)).
- **World state changing** — a story beat that enrages every monster in the dungeon, a quest whose
  completion opens a previously sealed passage.

A re-entry pipeline is an **optional transform applied on return**, between thaw and arrival. It
starts not from a seed and empty grid (as generation does) but from a fully-formed stored level plus
global game context. The vocabulary of generation carries over — an ordered sequence of passes that
modify map state — but, as noted below, most of the *code* does not.

---

## Two modes

| Mode | Starting point | Reuses generation? | Player-caused changes |
|------|----------------|--------------------|-----------------------|
| **Total regen** | Discard the stored level; build fresh | Yes — `runPipeline` unchanged | Lost (that's the point) |
| **Selective mutation** | The thawed, live level | No — needs a distinct stage contract | Preserved; stages edit around them |

These are different enough that trying to make one system serve both is a trap. Total regen is a thin
wrapper around the existing generator. Selective mutation is a genuinely new stage kind. The **regen
POC ships first**; selective mutation is deferred until there are concrete effects to design against.

---

## Determinism: the visit epoch

The map-generation RNG is a **derived** stream — a pure function of `(masterSeed, name, branch,
depth)`, re-derived and discarded each time, never saved (see
[rng-and-determinism.md](rng-and-determinism.md)):

```js
const mapgenRng = rng.deriveRng('mapgen', node.branch, node.depth);
```

This is the crux, and the easy mistake: **re-running the same pipeline on that same derived stream
reproduces the level bit-for-bit.** A regen that "rebuilds with the same parameters" would produce an
*identical* map — no observable change. To make regeneration differ while staying reproducible on a
seed, fold a **visit epoch** into the derivation:

- **Epoch 0** — the initial generation. Uses `deriveRng('mapgen', branch, depth)`, unchanged, so
  **every existing seed and every first visit is byte-identical to today**. Epoch 0 is the "original
  derivation" and must never gain an extra mix input.
- **Epoch ≥ 1** — the Nth regeneration. Uses `deriveRng('mapgen', branch, depth, epoch)`. Folding the
  epoch in yields an independent sequence per visit (independent by construction, per the determinism
  contract), so visit 1 ≠ visit 2 ≠ the original, yet each is fully reproducible from `(seed, epoch)`.

The epoch is **new persistent state**: a counter incremented each time a regen fires. It lives as a
**top-level field on the level** (`level.epoch`, default `0`), stamped by the pipeline and serialized
alongside the existing identity cluster (`branch`, `depth`, `pipelineId`, `seed`) in `serializeLevel`
/ `deserializeLevel` — it is the same kind of persisted per-level scalar as `seed`, so it rides beside
it rather than in a new container. It is deliberately **not** in the blackboard (which is generation-time
stage scratch, rebuilt on regen) nor in a dedicated metadata bag (the level has none today; see
["State and save footprint"](#state-and-save-footprint) for the trigger to add one). It is the one
genuinely new concept this feature introduces; everything else is plumbing.

Reentry — regeneration and any future selective-mutation stages — draws from the single epoch-keyed
stream `deriveRng('mapgen', branch, depth, epoch)`. A node is either a regen node or a mutation node,
never both, so there is one reentry consumer per visit and no need for a separate `'reentry'` stream
name.

**Determinism-contract note.** Epoch 0 keeping the no-argument derivation is load-bearing: appending
an explicit `0` would change the fold and re-roll every existing level. Reserve epoch 0 for the
original; only epochs ≥ 1 carry the extra mix input.

---

## Where it hooks in

The seam already exists. [`level-manager.js`](../../src/world/dungeon/level-manager.js)'s `travel()`
branches on whether the destination is in cold storage:

```js
if (coldStorage.has(dest.node)) {
  const blob = coldStorage.get(dest.node);
  level = thawLevel(blob, registry);   // ← today: thaw as-is
  ...
} else {
  level = await generate(getNode(transitMap, dest.node));
  ...
}
```

Re-entry inserts a transform at this branch:

- **Total regen** takes a generate-style path even when a blob exists — bumping the epoch, carrying
  over the entities that must survive (below), and discarding the rest of the blob.
- **Selective mutation** thaws as today, then runs the re-entry pipeline over the live level before
  `arrive()`.

**Config lives on the transit node.** A node already names its `pipelineId`; it gains a re-entry
policy alongside it — e.g. `reentry: 'regen' | <reentryPipelineId>` (absent ⇒ thaw unchanged, today's
behavior). This keeps re-entry a property of the level's place in the dungeon, decided by the same
data that decides its topology.

---

## The regen POC [poc]

The first slice: a node flagged `reentry: 'regen'` performs a **total reset** on return. On re-arrival
it bumps the visit epoch, re-runs the *existing* pipeline on the epoch-keyed stream, lands the player,
and throws away everything the previous visit left behind — with **one exception**.

### Quest-item carry-over

A total reset that deleted everything would let the player **soft-lock the game**: carry the Amulet of
Yendor onto a regenerating floor, drop it, leave, return — and the win condition is gone forever. So
the reset preserves one category of entity:

> Entities carrying a `questItem` component, found **anywhere in the frozen subgraph**, are carried
> across the regeneration intact and repositioned to the player's arrival tile.

Design points that shaped this rule:

1. **Key off the `questItem` component, not the amulet.** Engine code must not name content
   ([win-conditions.js](../../data/win-conditions.js) drives victory off the `questItem` id as
   content). Keying off the component keeps the mechanism content-agnostic and handles a second quest
   item, or a mode with several, for free.
2. **Carry the real entity — never re-mint.** The amulet happens to be stateless
   ([items.js](../../src/world/entities/items.js)), but a future quest item could hold state (charges,
   attunement, a bound name). Re-creating it from a content factory would both name content from
   engine code *and* silently drop that state. So carry-over moves the **actual entity subgraph** out
   of the blob being discarded, preserving all state and anything it contains.
3. **Search the whole subgraph, not just the floor.** A quest item can sit on the floor, be dropped by
   the player, rest **in a chest**, or ride **in a monster's inventory**. `collectSubgraph` already
   walks these references; detection must use it, or a regen while the amulet is in a chest would
   destroy it and soft-lock anyway. (The one case that is *not* in scope: an item the player is
   **carrying** rides the excluded player subgraph and never enters the freeze.)
4. **Place on the arrival tile.** [`resolveArrival`](../../src/world/map/spawn.js) already computes the
   exact tile the player lands on; dropping the carried-over item there guarantees it's reachable and
   literally under the player on entry, with no risk of it landing in a pocket the new layout walled
   off. "On the stairs" and "at the arrival point" are the same tile when keyed to the port the player
   came through. If several quest items are carried over, **stack them all on that one tile** — items
   co-occupy tiles freely, and this whole carry-over is a soft-lock kludge likely to be refined later,
   so the simplest placement wins over fanning out to neighbors.

### Mechanism

Carry-over reuses the freeze/thaw/exclude machinery `travel()` already has, with the exclude set
inverted — *keep* the quest subgraph, drop the rest:

1. Thaw the blob that was about to be discarded.
2. `collectSubgraph` the `questItem` entities out of it.
3. Remove those from the thawed level; destroy everything else; discard the thawed level.
4. Bump the epoch and run the fresh pipeline (epoch ≥ 1 derivation).
5. Place the preserved subgraph on the arrival tile — adding or overwriting a `position` on the
   top-level item (a quest item that was nested in a container had none).

### Why the guard looks like dead code — but isn't

Generation never *places* a quest item on a regenerating floor, so a future reader may inspect the
generator, conclude "quest items can't spawn here," and delete the guard. They can't: once the player
holds the amulet they may **drop it on any standable tile**, including a regenerating floor. The guard
protects a live path — an unwinnable save — not a theoretical one. State this wherever the guard
lives.

---

## Elapsed time: `frozenAtTurn` [poc-adjacent]

Re-entry stages that "simulate time" need to know **how long the player was away**, which is a
turn-count delta. Turn count is global (`meta.turnCount`, see
[save-system-design.md](save-system-design.md)), not a level property. So:

- On **freeze**, stamp `frozenAtTurn` (the current global turn) into the blob.
- On **re-entry**, `elapsed = now − frozenAtTurn` is the input selective-mutation stages consume
  (decay N turns of scent, advance a spawn timer, etc.).

`frozenAtTurn` is cheap and JSON-safe, so the regen POC can stamp it even though total reset doesn't
*use* elapsed time — it's the same freeze path, and having the field present from the start avoids a
second migration when selective mutation arrives.

**Save migration.** Adding `frozenAtTurn` (and the visit epoch) to the frozen-blob / level shape is a
save-affecting change and gets a version bump + migration like any other. Existing frozen blobs have
no `frozenAtTurn`; the migration defaults it to `1` (a floor frozen before the feature existed is
treated as frozen at the dawn of the run). The visit epoch defaults to `0`.

---

## Selective mutation [future]

Deferred until concrete effects exist to design against, but the shape is worth recording so the POC
doesn't foreclose it.

**Different stage contract.** Generation stages assume a blank canvas — `runPipeline` always starts
from a fresh `createLevel` ([pipeline.js](../../src/world/generation/pipeline.js)), and every
carve/CA/BSP stage expects empty tiles. None of them can run over a fully-formed level. Re-entry
stages need their own contract, taking the live level plus a **game-context** argument generation
never gets:

```
run(level, stageConfig, blackboard, rng, registry, context)
//                                                  ^ elapsedTurns, quest flags, global meta
```

The vocabulary of generation carries over; the code mostly does not. Expect only a handful of stages
to be shared, and don't contort generation stages into doubling as re-entry stages to chase reuse
that isn't there.

**The blackboard is a generation-time snapshot.** The blackboard survives freeze/thaw and the save
intact (`serializeLevel`/`deserializeLevel` in
[serialize.js](../../src/save/core/serialize.js)), so re-entry stages get the full generation
annotations — `level:zones`, `level:rooms`, `level:nodes`, chokepoints, palette. That's genuinely
useful. But it describes the level **as generated**, not **as it now is**: once the player digs a
wall, collapses a room, or kills the monster a zone was populated with, `level:rooms` and
`level:zones` describe a map that no longer fully exists. For total regen this is moot (the blackboard
is rebuilt). For selective mutation it's a hazard — a stage that reads `level:rooms` and trusts it can
act on a room the player destroyed. Treat the persisted blackboard as **as-generated provenance** and
verify against live tiles before mutating.

**Alternatives to a full pipeline.** For many effects, pipeline machinery may be overkill — a load-time
event handler ("on re-enter, if `worldFlags.enraged`, set every monster hostile") could suffice. Don't
build the selective-mutation pipeline until an effect actually needs ordered, parameterized,
RNG-consuming passes; reach for the simplest thing that covers the concrete scenario.

---

## State and save footprint

The whole feature's new persistent state, and where each piece lives:

- **Visit epoch** — a per-level counter, `0` for the initial generation, incremented each regen. Keys
  the epoch ≥ 1 map-generation derivation. Stored as a **top-level field on the level** (`level.epoch`),
  serialized beside `branch`/`depth`/`pipelineId`/`seed`. Defaults to `0` on migration.
- **`frozenAtTurn`** — the global turn count at freeze. It's a freeze-time annotation, not persistent
  level identity, so it lives on the **frozen-blob wrapper** alongside `playerMemory` (which
  `level-manager` already attaches there), not on the level. Feeds `elapsed`. Defaults to `1` on
  migration.

Both are additive and JSON-safe. Neither changes the derived map-generation seed for epoch 0, so
**existing seeds and first visits are untouched**.

**Why no `level.meta` bag.** The level has no dedicated metadata container today — the identity cluster
(`branch`, `depth`, `pipelineId`, `seed`) sits as loose top-level fields, and `epoch` is the same kind
of scalar, so it joins them rather than motivating a new structure for one field. The trigger to add a
`level.meta = {}` bag and migrate the whole cluster into it in one deliberate pass is the accumulation
of **several** persistent per-level lifecycle fields — not the first one. Note that `frozenAtTurn` does
*not* count toward that threshold: it lives on the frozen-blob wrapper, not the level.

---

## What to avoid

- **Regenerating on the same derived stream** — reproduces the level bit-for-bit; nothing changes.
  Always fold the visit epoch in.
- **Adding a mix input to epoch 0** — re-rolls every existing level. Epoch 0 is the original no-arg
  derivation, permanently.
- **Re-minting carried-over entities from content factories** — names content from engine code and
  drops any state the entity holds. Carry the real subgraph.
- **Detecting quest items by floor position only** — misses items in chests and inventories; walk the
  subgraph.
- **Trusting the blackboard as a live map** in selective-mutation stages — it's a generation-time
  snapshot the player may have invalidated.
- **Building the selective-mutation pipeline before a concrete effect needs it** — a load-time event
  handler may be enough.
