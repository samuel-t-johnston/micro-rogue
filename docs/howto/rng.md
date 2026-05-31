# RNG

*How the RNG works and how to change it.*

The RNG is a [Mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) PRNG exposed as a single shared instance in [`src/engine/rng.js`](../../src/engine/rng.js). All random decisions in the game (map generation, combat, item drops, AI) draw from this one instance so that a given seed produces a fully reproducible run.

Two values are tracked separately:

| Value | Accessor | Purpose |
|---|---|---|
| `_seed` | `getSeed()` | The value passed to `init()`. Stored in `meta.seed` for reference and potential level reconstruction. |
| `_state` | `getState()` / `setState()` | The PRNG's current position in its sequence. Stored in `meta.rngState` so a loaded save resumes exactly where it left off. |

Re-seeding from `_seed` alone on load gives deterministic level generation but not deterministic mid-game continuation. That's why `rngState` exists as a separate field.

## Replace the algorithm

The implementation can be swapped without touching anything outside `rng.js`, as long as the exported API contract is preserved:

- `init(seed?)` — initialise with the given seed, or generate one if omitted
- `getSeed()` — return the original seed (must survive calls to `setState`)
- `getState()` — return a JSON-serialisable snapshot of the current sequence position
- `setState(state)` — restore that snapshot exactly; the next `random()` call must produce the same value it would have before the snapshot was taken
- `random()` — float in `[0, 1)`
- `nextInt(min, max)` — integer in `[min, max)`
- `pick(arr)` — random element from array

The tests in [`src/engine/rng.test.js`](../../src/engine/rng.test.js) exercise the full contract. Run them after any algorithm change — they should all pass without modification.

Update the `@see` link in the JSDoc block to point to the new algorithm's reference.

## Add a convenience method

Add to the `rng` export object in `rng.js` and add a corresponding test in `rng.test.js`. Don't add speculative helpers — only add a method when something in the codebase actually needs it.

## Load a save

The persistence layer is responsible for calling both steps:

```js
rng.init(save.meta.seed);          // records the seed; sets state = seed
if (save.meta.rngState !== null) {
  rng.setState(save.meta.rngState); // restores exact sequence position
}
```

`rngState` can be `null` in migrated saves that predate the field — re-seeding from `seed` is the correct fallback in that case and is handled at the call site, not inside the RNG module.

## Worth knowing

- **Mulberry32 has known limitations.** It cannot produce roughly one-third of all possible 32-bit values, and it fails PractRand at 32 GB of output. Neither matters for a roguelike — a full playthrough consumes at most a few million samples, far below any failure threshold.
- **The JS precision concern doesn't apply here.** Some Mulberry32 ports accumulate floating-point error in the counter after ~3.3 million iterations. This implementation coerces the state to a 32-bit unsigned integer on every advance (`>>> 0`), so no drift occurs.
- **State is a single uint32.** `getState()` returns a plain number, which is trivially JSON-serialisable. If you replace the algorithm with one that has larger state (e.g. a 128-bit generator), `getState()` should return a plain object or array — verify the save system handles it.
