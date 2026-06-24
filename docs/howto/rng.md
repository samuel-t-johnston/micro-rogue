# RNG

*How the seeded RNG works and how to use it. For the determinism model and the contract, see [rng-and-determinism.md](../design/rng-and-determinism.md).*

The generator is [Mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c). One **master seed** per game yields any number of **independent streams**, each derived from the master by name, so unrelated concerns never perturb one another's sequences. It all lives in [`src/engine/core/rng.js`](../../src/engine/core/rng.js).

There are two ways to get a stream:

- **`stream(name)`** — persistent, cached; its state is part of the save (e.g. `gameplay`).
- **`derive(name, ...mix)`** — a pure function of `(master, name, ...mix)` → a fresh RNG, used and discarded, **never saved** because it's re-derivable from its key (e.g. map generation).

## The ambient `rng`

Most code just wants "the game's RNG." The exported `rng` singleton is a façade over the current world's `gameplay` stream, plus the world-management calls:

| Call | Does |
|---|---|
| `rng.random()` / `rng.nextInt(min,max)` / `rng.pick(arr)` | draw from the `gameplay` stream |
| `rng.init(seed?)` | start a new world (random master if omitted) |
| `rng.deriveRng(name, ...mix)` | a fresh re-derivable stream (map generation) |
| `rng.stream(name)` | a named persistent stream (auto-saved) |
| `rng.snapshot()` / `rng.restore(snap)` | persist / restore all persistent streams (`{ seed, streams }`) |
| `rng.getMasterSeed()` | the world's master seed |

`createRng(seed)` (one stream) and `createRngService(masterSeed)` (a master + its streams) are also exported for code that wants to own its own RNG explicitly. A stream instance exposes `random` / `nextInt` / `pick` / `getState` / `setState` / `getSeed`.

## Draw a random value

```js
import { rng } from '../engine/core/rng.js';
rng.pick(directions);   // gameplay stream — combat, AI, loot all share it
```

## Generate something reproducibly by key (e.g. maps)

```js
const genRng = rng.deriveRng('mapgen', branchId, depth); // pure fn of (master, name, branch, depth)
runPipeline(config, genRng, registry);
```

Same `(master, name, ...mix)` always yields the same sequence, independent of the gameplay stream — so play never changes generation and any level generates on demand. String mix args are hashed; numbers are used directly.

## Add a new stream

Just pick a name — there's no registry to edit:

- **Persistent** (must survive a reload): `rng.stream('spawns')`. It's lazily created and automatically included in `rng.snapshot()`, so the save system carries it with no extra wiring.
- **Re-derivable by key** (reconstructable from inputs): `rng.deriveRng('my-feature', ...mix)`.

Because streams are independent by construction, adding one perturbs **no existing seed** — see the determinism contract in [rng-and-determinism.md](../design/rng-and-determinism.md).

## Load a save

The persistence layer round-trips the whole stream map; you don't call into the RNG per-stream:

```js
// serialize: meta gets { seed, streams: { gameplay: <state>, … } }
meta = { ...rng.snapshot(), turnCount, nextEntityId };
// load: rebuild the world from the snapshot
rng.restore({ seed: save.meta.seed, streams: save.meta.streams });
```

The v1 save format stored a single `meta.rngState`; the v1→v2 migration ([`save-system.js`](../../src/save/core/save-system.js)) lifts it into `meta.streams.gameplay`.

## Replace the algorithm

Swap the body of `createRng` in `rng.js`; nothing outside needs to change as long as the instance contract holds (`random` / `nextInt` / `pick` / `getState` / `setState` / `getSeed`). The mix helpers (`hashName`, `deriveSeed`) are independent of the generator. Update the JSDoc `@see` link, and run [`rng.test.js`](../../src/engine/core/rng.test.js) — it exercises the full contract.

## Worth knowing

- **Mulberry32's limits don't matter here.** It can't produce ~⅓ of 32-bit values and fails PractRand at 32 GB; a full run consumes a few million samples, far below either threshold.
- **No float drift.** The state is coerced to a uint32 each advance (`>>> 0`), so the counter-accumulation bug some ports have doesn't occur.
- **A stream's state is a single uint32** — trivially JSON-serialisable. A larger-state generator would need `getState()` to return a plain object/array; verify the save system handles it.
- **Mix functions are part of the determinism contract.** Changing `hashName` / `deriveSeed` re-rolls every seed — fine pre-players, noted once the game ships.
