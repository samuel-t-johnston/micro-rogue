# Saving

*The save/load lifecycle: what's persisted, when autosave fires, how a load rehydrates a run, and how to add a schema migration. Design rationale: [save-system-design.md](../design/save-system-design.md). For the diagnostic export, see [support-bundle.md](support-bundle.md).*

## How it works

Everything lives in [`src/save/core/save-system.js`](../../src/save/core/save-system.js): the pure snapshot/restore, the migration-chain runner, and thin `localStorage` I/O over a **single slot** (`'rogue:save'`, overwritten each save). No autosave triggers or UI wiring live there — those build on top in the game scene.

### What a save contains

`serializeGame(...)` produces a JSON-safe object:

- **`meta`** — the RNG snapshot (`seed` + named streams; see [rng-and-determinism.md](../design/rng-and-determinism.md)), `turnCount`, and `nextEntityId`.
- **`playerId`** + **`entities`** — the **whole entity registry as one flat list**, referenced by id. The player is serialized inline like any other entity (with the top-level `playerId` pointer), *not* hoisted to its own key. This is because items inside chests/inventories/equipment are entities that live only in the registry — serializing `level.entities` would miss them. (Two deliberate divergences from the design doc, noted in the file header.)
- **`currentNodeId`** + **`currentLevel`** + **`frozenLevels`** — the multi-floor state from the level manager's `snapshot()`. Under model (b) the registry holds only the active floor + player, so `entities` is exactly that; each frozen floor carries its own serialized entities inside its blob (see [dungeon-layout.md](dungeon-layout.md)).
- **`saveVersion`** / **`gameVersion`** / **`versionHistory`** — schema and release versioning.

### When it saves

The game scene's `saveGame()` calls `commitSave(...)` (serialize-then-write), guarded so a finished or torn-down run is never persisted. It fires on two triggers ([`game-scene.js`](../../src/ui/scenes/game-scene.js)):

- **Turn start** — wired into the turn manager's `onTurnStart`, for the player only, the instant the world is fully settled.
- **Tab hide** — a `visibilitychange` handler saves when the page is hidden, because mobile kills backgrounded pages without warning.

A finished run is the exception: `endGame()` (death or victory) calls `clearSave()` — the run is over either way, so it's deleted, never persisted.

### When it loads

`loadSavedGame()` does the whole read → migrate → rehydrate round trip: `readSave()` (parse) → `loadSave()` (migrate to current schema) → `deserializeGame()` (restore the RNG to its exact position, rebuild every entity, the level, and resolve the player). The game scene's "continue" path calls it; a present-but-unloadable save (too new, failed migration, corrupt) is surfaced to the host via `onLoadFailed` rather than silently discarded into a fresh game. The menu's Continue affordance uses the lightweight `getSaveMeta()` / `hasSave()` without rehydrating the whole save.

## Migrations

The schema evolves through an **append-only** chain — the `migrations` array of `{ from, to, migrate(save) → save }` steps. `loadSave()` runs every step whose `from >= save.saveVersion` against a deep clone, bumping `saveVersion` and appending to `versionHistory` after each. It only returns on full success, so a partial migration never leaks. A save newer than this build throws `SaveTooNewError`; a step that throws becomes a `MigrationError` carrying the from/to.

**Rules that matter:**

- **Never edit a shipped migration** — it's frozen the moment a save could exist at that version.
- **Don't depend on mutable data** from inside a migration. (The v2→v3 step hard-codes the start node id rather than reading `transit-map.js`, which can change after the migration ships.)
- **Migrate frozen floors too** — entity-shape changes must walk both `save.entities` and every `save.frozenLevels[*].entities` (see the v3→v4 and v4→v5 steps).

### Add a migration

1. Bump `SAVE_VERSION`.
2. Append `{ from: <old>, to: <new>, migrate(save) { … return save; } }` to `migrations`.
3. Ship a **fixture** — a real save at the source version in [`src/save/fixtures/`](../../src/save/fixtures) (`save-v<old>.json`) — and a test that loads it through `loadSave()` and asserts the post-migration shape. Save migrations are [test-first by rule](../../AGENTS.md): every migration ships with its fixture and test.

## See also

- [Save system design](../design/save-system-design.md) — the full schema and rationale.
- [RNG & determinism](../design/rng-and-determinism.md) — what the `meta` streams restore.
- [Support bundle](support-bundle.md) — exporting a save + log + device info for diagnosis.
- [Dungeon layout](dungeon-layout.md) — the frozen-floor state that rides in the save.
