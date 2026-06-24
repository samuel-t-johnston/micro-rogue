# RNG and Determinism
Purpose: How ROGµE produces reproducible results from a seed across independent concerns — and how map generation stays deterministic without generating every level up front.

## The problem: one shared stream is order-dependent

A PRNG stream is a *sequence*. "What does level 2 generate?" is not answered by a seed alone — it's answered by *how many values have been drawn before generation runs*. If generation, combat, AI, and loot all draw from one shared stream, then any play between floors advances that stream by an unpredictable amount, and level 2 generates differently every run. Sharing a seed would mean nothing.

The fix is to stop sharing a stream. Each concern gets its **own** stream, derived from a single master seed, so the streams are independent **by construction** — one concern's draws never move another's sequence.

## The model: a master seed and named streams

One **master (world) seed** per game, owned by an RNG service. Every stream is derived from it by **name** (plus optional mix inputs). There are two ways to access a stream, and the distinction is the core of the design:

### Persistent streams — `stream(name)`

Lazily created the first time it's asked for, cached, and its evolving **state is saved and restored**. For ongoing consumption that must survive a reload.

- `service.stream('gameplay')` — the one gameplay stream today (combat, AI, loot, item rolls all share it). Its state is part of the save.
- A fork's "wandering-spawn timer" would be `service.stream('spawns')` — no central wiring needed.

### Derived streams — `derive(name, ...mix)`

A **pure function** of `(masterSeed, name, ...mix)` → a fresh RNG. Used and discarded. **Never saved**, because it can always be re-derived from its key.

- `service.derive('mapgen', branchId, depth)` — the generation RNG for one level.

This is what makes generation both deterministic *and* lazy: a level's seed is **computed from its identity**, not consumed in sequence. Level N generates identically whether or not you fought anything on the way there, and you can generate it on demand without "playing forward" through earlier floors.

## Deriving a stream seed (the mix)

A name is hashed to an integer (FNV-1a); the master seed and any mix inputs are folded together with a splitmix32 finalizer, in a **fixed order**. Strings among the mix inputs are hashed the same way first; everything else is a `uint32`.

```js
// FNV-1a: string -> uint32
function hashName(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// splitmix32 finalizer — avalanche one word
function mix32(x) {
  x = (x + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

// Fold master + ordered parts into a stream seed.
function deriveSeed(master, ...parts) {
  let h = master >>> 0;
  for (const p of parts) h = mix32((h ^ (p >>> 0)) >>> 0);
  return h >>> 0;
}

// stream('gameplay')          -> deriveSeed(master, hashName('gameplay'))
// derive('mapgen', branch, n) -> deriveSeed(master, hashName('mapgen'), branch, n)
```

These functions are illustrative; the implementation may refine them. They are **part of the determinism contract** once shipped — changing them re-rolls every seed (fine pre-players; see the contract below).

The RNG instance itself is the existing Mulberry32 ([`src/engine/core/rng.js`](../../src/engine/core/rng.js)), factored into a `createRng(seed)` building block. The service (`createRngService(masterSeed)`) layers `stream` / `derive` on top.

## Map generation

The generation pipeline ([`runPipeline`](../../src/world/generation/pipeline.js)) receives a **per-level generation RNG**, not the global gameplay stream:

```js
const genRng = service.derive('mapgen', branchId, depth);
const level = await runPipeline(pipelineConfig, genRng, registry);
```

A level's identity is `(branch, depth)`, both folded into the mix — so branches and floors are independent, and the same pipeline run for two different levels yields different results within its parameters. Stages consume `genRng` in a stable order, exactly as before.

The **derived seed is stored on the level** (map-generation.md, "Level Lifecycle") so a frozen level reconstructs even if the derivation function later changes. Generation never touches the gameplay stream, so it can run at any time without perturbing play — and play never perturbs it.

## The gameplay stream and the save

Gameplay draws from `service.stream('gameplay')`. The save's `meta` changes from a single stream to a master seed plus a map of *instantiated persistent* streams' states:

```jsonc
"meta": {
  "seed": 8371920456,             // the master/world seed
  "streams": { "gameplay": 123456 }, // persistent streams' states; derived streams are absent
  "turnCount": 412,
  "nextEntityId": 88
}
```

Derived streams (mapgen) are not stored here — only the per-level derived seed lives on each level. This is the engine's **first real save migration**: v1→v2 lifts the old `meta.rngState` into `meta.streams.gameplay`, exercising the migration chain against a genuine schema change. See [save-system-design.md](save-system-design.md).

## The determinism contract

Same master seed + same game version ⇒ identical generation for every `(branch, depth)`.

**Breaks existing seeds** (acceptable pre-players; note it once the game ships):
- Changing `mix32` / `hashName` / the fold order.
- Renaming a stream, or changing a derived stream's mix inputs or their order.
- Changing the order in which a stage consumes its RNG, or the order of stages in a pipeline.

**Does *not* break existing streams** — the property that makes this worth doing:
- **Adding a brand-new stream.** Because streams are independent by construction, a new consumer with its own name draws an independent sequence and perturbs nothing that already exists. This is the opposite of the shared-stream world, where any new draw shifted everyone downstream.

## Forking: adding a stream

A fork (or a future engine feature) adds an RNG concern by **picking a name** — `service.derive('my-feature', ...mix)` for reproducible-by-key rolls, or `service.stream('my-feature')` for a persistent, saved stream. No registry to edit, no risk to existing seeds. The name *is* the registration.

## What to avoid

- **Drawing generation values from the gameplay stream** (or vice-versa) — it reintroduces the order-dependence this whole design removes.
- **Persisting a derived stream's mid-run state** — derived streams are defined by their key; store the key (or the level's derived seed), not the state.
- **Reusing a derived key for two different purposes** — same `(name, …mix)` yields the same sequence; if two concerns share a key they share a sequence.
- **Splitting the gameplay stream prematurely** — one `gameplay` stream is fine until a concrete need (e.g. shareable combat-only seeds) justifies giving combat/AI/loot their own.
