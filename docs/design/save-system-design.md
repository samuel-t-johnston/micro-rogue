# Save System Design
Purpose: Initial save system design for ROGµE.

> **As-built status (M4 persistence core).** This doc was written before any code. The persistence
> core (`src/save/save-system.js` + `src/save/serialize.js`, `saveVersion: 1`) implements the
> principles, versioning, and migration design below as written, with **two structural divergences**
> the code forced — both called out inline where they apply:
> 1. **Serialization unit is the whole entity registry as one flat top-level `entities` list,
>    referenced by id** — not a per-level `entities` array. Items inside chests/inventories/equipment
>    are entities that live *only* in the registry, so a per-level array would silently drop them.
> 2. **The player is serialized inline in that list** (with a top-level `playerId` pointer), **not
>    hoisted to a top-level `player` key.** It stays a normal entity.
>
> `frozenLevels`, `meta.score`, `meta.storyFlags`, and `meta.difficultySettings` are forward-looking
> (M5+) and not part of the v1 save; they land via migrations when their features exist.

## Core Principles

- **JSON throughout** — human-readable, no compression. Acceptable size for roguelike state; invaluable for development and debugging.
- **Single save slot** — one file, overwritten each turn. The social contract of the roguelike: no save scumming, no branching save states.
- **Death deletes the save** — atomically, from the player's perspective. Save → player dies → file gone. Not save → save → save → figure out which to delete.

---

## Save File Structure

```json
{
  "saveVersion": 4,
  "gameVersion": "0.3.1",
  "versionHistory": [
    { "saveVersion": 1, "gameVersion": "0.1.0", "savedAt": "2025-01-10T14:23:00Z" },
    { "saveVersion": 3, "gameVersion": "0.2.4", "savedAt": "2025-03-02T09:11:00Z" },
    { "saveVersion": 4, "gameVersion": "0.3.1", "savedAt": "2025-04-18T20:45:00Z" }
  ],
  "savedAt": "2025-04-18T20:45:00Z",
  "meta": { ... },
  "playerId": 1,
  "currentLevel": { ... },
  "frozenLevels": [ ... ],
  "entities": [ { "id": 1, "components": { ... } }, ... ]
}
```

> **As-built:** there is no top-level `player` object. `entities` is the flat list of *every*
> entity in the registry (player, creatures, furniture, and every item — including those nested in
> inventories, equipment slots, and containers), each keyed by integer `id`; cross-references between
> entities are stored as ids. `playerId` points at the player's entry. `frozenLevels` is M5+ and
> absent from v1.

### `meta` — Top-Level Game State

```json
{
  "seed": 8371920456,
  "rngState": { ... },
  "turnCount": 412,
  "score": 1840,
  "storyFlags": {
    "bossDefeated": false,
    "altarActivated": true
  },
  "difficultySettings": { ... }
}
```

- **`seed`** — the value used to initialize map generation. Stored for reference and potential level reconstruction.
- **`rngState`** — snapshot of the RNG's current position in its sequence at the moment of save. Re-seeding from scratch on load gives deterministic level generation but not deterministic continuation. Snapshot the state, restore it exactly.
- **`storyFlags`** — arbitrary key/value pairs. Prefer flat boolean flags where possible; avoids schema churn.

> **As-built (`meta` v1):** `{ seed, rngState, turnCount, nextEntityId }`. `rngState` is a single
> integer (Mulberry32's `_state`), restored exactly via `rng.init(seed)` then `rng.setState(rngState)`.
> `nextEntityId` preserves the registry's id counter so post-load spawns never collide with — or
> reuse the freed ids of — loaded entities. `score`, `storyFlags`, and `difficultySettings` don't
> exist in the game yet and are omitted; a future migration adds them when those features land.
>
> **Planned (`meta` v2, M5).** The single `rngState` becomes a map of persistent RNG streams:
> `{ seed, streams: { gameplay: <state>, … }, turnCount, nextEntityId }`. `seed` becomes the
> *master* seed; `gameplay` is the one persistent stream today, and map generation draws from
> *derived* streams that are never stored here (only each level's derived seed is kept, on the
> level). This is the engine's first real migration — **v1→v2 lifts `rngState` into
> `streams.gameplay`** — and it ships with a fixture save at v1 and a test per [AGENTS.md](../../AGENTS.md).
> See [rng-and-determinism.md](rng-and-determinism.md).

### `playerId` — Player Pointer

The player is an entity like any other (see game-architecture notes). The original design hoisted it
to a top-level `player` key to keep it from being serialized into a departing or arriving level.

> **As-built — not hoisted.** The player is serialized inline in the flat `entities` list like every
> other entity; a top-level `playerId` records which entry it is (load also falls back to scanning
> for the unique `playerControlled` component). The hoist solved an M5-only concern — *don't freeze
> the player into the level it's leaving* — that doesn't arise with a single level, and it would be a
> special case fighting the flat-registry-by-id model: hoisting the player while every other entity
> (including the items it carries) lives in `entities` means the player's `inventory`/equipment refs
> would point across the player/entities boundary. The invariant that makes inline serialization safe
> at transition time is simply *the player is always on the active level* — you never freeze the level
> an entity is standing on. Revisit if M5 makes per-level entity ownership explicit (that's what the
> migration chain is for).
>
> Player state is whatever components the entity carries: `health`, `inventory` (item refs → ids),
> `wearsEquipment` (slot refs → ids), `memory` (goal state — `autoMoveTarget`, `knownEnemyIds`), `ai`
> (goal-key stack + `lastGoal`), `tilePerception`, position, factions, etc. Item *locations* are
> already discriminated unions carrying ids (`{ type: 'equipped', ownerId, slot }` etc.); see
> `src/world/components.js`.

### `currentLevel` — Active Level State

```json
{
  "id": "dungeon-floor-3",
  "seed": 8371920456,
  "pipeline": "dungeon",
  "baseTiles": [ ... ],
  "tileOverrides": { "12,7": { "type": "pit" }, ... },
  "blackboard": {
    "room:4:type": "armory",
    "level:theme": "dungeon"
  },
  "entities": [ ... ]
}
```

- **`baseTiles`** — compact terrain data, ideally a flat array indexed by `y * width + x`.
- **`tileOverrides`** — sparse map of dynamic terrain mutations. Only entries where the terrain has changed from base.
- **`blackboard`** — preserved in full. Tags may be needed for re-entry logic; don't discard them on freeze.
- **`entities`** — all non-player entities on this level. Stationary entities with turn timers included.

> **As-built (`currentLevel` v1):** `{ width, height, tiles, overrides, blackboard, entityIds }`.
> - `tiles` is kept as the live 2D `tiles[y][x]` string array, not reshaped into a flat `baseTiles`
>   (the reshape buys nothing at current sizes; revisit only if save size matters).
> - `overrides` serializes the `Map` as `[["x,y", tileId], ...]` entries (the design's `tileOverrides`).
> - The level does **not** embed entity objects. It stores `entityIds` — the ids of the entities
>   placed on it (the player included). The entities themselves live in the top-level `entities` list.
>   On load, each id is re-placed via `level.placeEntity()`, which rebuilds the spatial index from
>   positions, so the index is never serialized.

### `frozenLevels` — Inactive Levels

Same structure as `currentLevel`. Serialized when the player departs, deserialized on return. Enemies that follow the player through a transition travel with the player, not with the level they left.

> **Forward note (M5, not in v1):** under the as-built model a frozen level is just another
> `{ ..., entityIds }` block; the entities it owns live in the single flat top-level `entities` list
> alongside every other level's, partitioned by which level's `entityIds` references them. The
> "travels with the player" rule becomes a matter of which level's `entityIds` an entity is listed
> under at save time — no entity objects move between blocks.

---

## Versioning

Two version numbers, distinct purposes:

| Field | Type | Increments when |
|---|---|---|
| `saveVersion` | integer | Save schema has a breaking change |
| `gameVersion` | semver string | Any game release |

Most game updates do not bump `saveVersion`. A field rename bumps it; adding an optional field with a sensible default usually does not. Keep them decoupled.

### Version History

Every save carries a `versionHistory` array logging each version the save has passed through, with timestamps. A save that was created at version 1, migrated to 3, then migrated to 4 is structurally distinct from one created at 4 directly. When a migrated save produces a bug, this is how you find out which path it took.

---

## Migration

### The Migration Chain

```javascript
const migrations = [
  {
    from: 1,
    to: 2,
    migrate(save) {
      // e.g. rename the `hp` component to `health`. Entities are the flat top-level list,
      // each `{ id, components: { <name>: data } }`, so migrations walk `save.entities`.
      save.entities.forEach(e => {
        if ('hp' in e.components) {
          e.components.health = e.components.hp;
          delete e.components.hp;
        }
      });
      return save;
    }
  },
  {
    from: 2,
    to: 3,
    migrate(save) {
      // e.g. add rngState field that didn't exist before
      save.meta.rngState = null; // null signals "reseed on load"
      return save;
    }
  },
];
```

On load, if the save is at version 1 and current is 3, both migrations run in sequence. Each receives the output of the previous.

**Migrations are append-only and never modified.** Once a migration is shipped, it is frozen. Players may have saves at any version; modifying an old migration breaks their upgrade path silently.

### Running the Chain

```javascript
function loadSave(raw) {
  const current = CURRENT_SAVE_VERSION;

  if (raw.saveVersion > current) {
    throw new SaveTooNewError(raw.saveVersion, current);
  }

  // Deep clone before touching — never mutate the only copy
  let save = structuredClone(raw);

  // Run applicable migrations in order
  const applicable = migrations.filter(m => m.from >= save.saveVersion);
  for (const migration of applicable) {
    try {
      save = migration.migrate(save);
      save.saveVersion = migration.to;
      save.versionHistory.push({
        saveVersion: migration.to,
        gameVersion: CURRENT_GAME_VERSION,
        savedAt: new Date().toISOString()
      });
    } catch (err) {
      throw new MigrationError(migration.from, migration.to, err);
    }
  }

  return save;
}
```

### Failure Modes

| Situation | Handling |
|---|---|
| `saveVersion > current` | Refuse load, tell the player their save is from a newer version |
| Migration throws | Wrap per-step, surface which migration failed |
| Partial migration | Migrate a deep clone only; never write back until the full chain succeeds |
| Gap in migration chain | Runtime assertion on startup; should never reach a player |

---

## Autosave

### When to Save

Save when the player's turn begins — after all other entities have resolved their turns and the state is fully settled. This means:

- Animations complete
- Effects applied
- Dead entities removed
- Action queue fully drained

Saving mid-resolution captures a state that would be awkward to load back into. Saving at turn-start captures a clean, unambiguous state.

### On Exit

Register a `visibilitychange` handler that calls the same save function:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveGame();
  }
});
```

Mobile will kill backgrounded pages without warning. This catches the gap between turns — which in a roguelike is just the player thinking, so it will rarely differ from the last turn-end save. Worth adding as a one-liner for the edge cases: UI state changes, settings, anything that doesn't advance the turn.

### Optimization Note

If the player is tap-pathing across the map and the pathfinder is issuing one turn per tile, saving on every single step may be unnecessary. Debouncing — or saving only when the action queue fully drains — avoids thrashing. Not needed at first; revisit if save writes become a bottleneck.

### Death

```
turn ends → player is dead → delete save → show death screen
```

Not:

```
turn ends → save → player is dead → delete save → show death screen
```

The distinction matters if the write fails or is interrupted. Don't write a dead-player save that could be loaded.

---

## What to Avoid

- Storing game version and save version as the same field — they serve different purposes
- Modifying migrations after they've shipped — append only
- Mutating raw save data during migration — clone first, commit on full success
- Saving mid-turn-resolution — state is unsettled and awkward to restore
- Writing a save on death before deleting it — delete comes first, or they're atomic
- Forgetting the blackboard in frozen level serialization — it may be needed on re-entry