# Entity Tables Design

Purpose: a single mechanism for **weighted, nestable, RNG-driven procedural generation** — the
"roll on a table" primitive that a roguelike leans on for monster loot, chest contents, floor item
spawns, and monster population. One table definition, invoked from many systems, always deterministic
because the caller supplies the RNG.

This document is the agreed plan. It records the decisions we settled during prototyping, the data
model, the roll semantics, and how the first consumer (death loot) is wired.

> **As-built status.** The engine (`src/world/tables/entity-table.js`) and the first consumer —
> **monster loot drops** on death — are built and shipped. The map-generation randomizers
> (`stage-populate`'s item-weight pick and creature specs) are **not yet** folded onto tables; that
> **unification** is the named follow-up (see §8). Player-/author-facing guide:
> [docs/howto/loot-tables.md](../howto/loot-tables.md).

---

## 1. Motivation — subsume the ad-hoc randomizers

Before this system the codebase had four separate hand-rolled randomizers:

1. `weightedItem(pool, weights, rng)` in `stage-populate` — a weighted pick of an item prefab id.
2. Creature specs `{ type, count, weights, separate }` in each pipeline's `populate` config.
3. Item generators `(rng) => ItemSpec[]` in `item-tables.js`, consumed by the loadout stage.
4. Static `contents: [prefabId, …]` lists for chests.

Each is a special case of "roll something from a weighted set." Entity tables generalize the shape so
new generation sites (loot, spawners, containers, floor population) share one vocabulary and one
determinism story. The roadmap milestone is v0.5.0 ("Entity Tables").

## 2. The core decision: rows emit *specs*, not entities

A table roll returns **specs** — lightweight descriptors like `item('sword')` or `item('arrow', 10)` —
**not built entities**. A spec carries no placement context, so the identical output can land in an
inventory (host id), a chest (container id), or on a floor tile `(x, y)` depending only on who
*resolves* it. This is the same spec/entity split the loadout stage already relies on
(`item-tables.js` → `stage-loadout`), and keeping it means one loot table works for a corpse drop, a
chest, and a floor spawn without change.

A row that produced live entities would have to know its registry, coordinates, and container host —
coupling content to placement. We explicitly rejected that.

## 3. Data model

Definitions are **plain data with tiny helpers** — the idiom already used for pipelines
(`data/pipelines/*.js`) and the `item()` spec constructor — not a fluent builder and not JSON (JSON
can't hold the context-dependent weight *functions*). The helpers live in
`src/world/tables/entity-table.js`:

- **`table(id, description, { rolls, rows })`** — a named table. `rolls` (default `1`) is how many
  independent row-picks one invocation makes: a fixed count, an inclusive `[min, max]` range, or a
  `(ctx) => number`.
- **`row(weight, gen)`** — one row. `weight` is a `number` or `(ctx) => number` (for depth/level-scaled
  odds); non-positive weights can't be picked. `gen` is `(ctx) => spec[]`, which may return `[]`.
- **`nothing`** — the canonical "no drop" generator (`() => []`), used as `row(6, nothing)`.
- **`ref(id)`** — a generator that delegates to another table by id (nesting). See §5.
- **`rollTable(table, ctx)`** — performs the rolls and returns the accumulated specs.

```js
export const orcLoot = table('orcLoot', 'What an orc drops', {
  rolls: [1, 2],                 // a small pile, not a single item
  rows: [
    row(6, nothing),             // most rolls yield nothing
    row(3, () => [item('meat')]),
    row(3, () => [item('dagger')]),
    row(({ depth }) => Math.max(0, depth - 2), () => [item('sword')]), // deeper = better steel
    row(2, ref('potions')),      // nested table
  ],
});
```

Multiplicity — "zero, one, or many" — comes from two independent levers: a row can emit an array of
several specs, and `rolls` can pick several rows. A powerful lone monster is one row emitting one spec;
a swarm is either one row emitting many or `rolls: [2, 4]`.

## 4. Determinism contract

The RNG draw order of one `rollTable` is fixed and part of the contract (like the item-pool order in
`stage-populate`). Changing it re-rolls existing seeds.

1. If `rolls` is a range, **one draw** for the roll count.
2. Then **one draw per roll** for the weighted row pick.
3. A nested table (`ref`) recurses inside its row's generator, spending its own draws there.

Weight and roll-count functions must be **pure** — they read `ctx` only, never the RNG. Tables are
**never serialized** (their output *entities* are), so changing a definition needs no save migration;
it only changes what not-yet-generated content rolls.

## 5. Nesting and the catalog — `ref` + `useTables`

`ref(id)` resolves at roll time against a **single installed catalog**, mirroring how `ENTITY_PREFABS`
is one authored catalog of spawnable types. The catalog is a declared object literal
(`data/tables/index.js` → `TABLES`), installed once per entry point with **`useTables(TABLES)`**:

- `main.js` calls it at startup (beside `initAudio()`), so in-game rolls resolve.
- Test setup installs the catalog (or a small test-local one) in `beforeEach`.
- **Any future generation entry point** (notably the map-visualizer) must install it too — see §8.

We chose the declared-catalog-plus-`useTables` shape over the two alternatives on purpose:

- vs. **threading a catalog through `ctx`** — the injected form is pure but forces every invocation site
  to assemble the full transitive closure of referenced tables; a global catalog makes cross-module
  refs just work.
- vs. **a self-registering registry** (`table()` inserting itself into a module Map) — that makes
  `table()` side-effecting, invites silent id collisions, and creates import-order hazards. The static
  literal keeps `table()` a pure constructor and makes collisions visible in one file, at the cost of
  the single `useTables` call per entry point.

A `MAX_DEPTH` guard in `ref` turns reference cycles into a thrown error rather than a stack overflow.

## 6. The context object

`ctx` is a small, documented bag — not the whole game state, so tables stay unit-testable with a
fixture ctx. It carries at least `{ rng }`; tables that scale on situation also read `depth`, `source`
(the dying creature, the room/zone, …), and later `player`, `turn`, etc. Missing fields are `undefined`.
The RNG is always injected by the caller — a table never reaches for an ambient RNG.

## 7. As-built: monster loot drops

The death path is the first consumer:

- `combat/death.js`'s `onDeath` hook (previously an empty stub) calls `dropLoot`.
- `combat/death-loot.js`:
  - `lootTableFor(entity)` maps the creature's `entityTypeId` to its table (`data/tables/loot.js`),
    returning `null` for types with none (so those drop nothing — unchanged behavior).
  - `dropLoot` builds `ctx = { rng: gameplay stream, registry, source: entity, depth: level.depth }`,
    rolls the table, and instantiates each spec onto the corpse tile via `placeItemOnMap` (the same
    "comes to rest on the floor" path player-drop and thrown-item landing use). `dropSpec` mirrors the
    loadout stage's `addLoadoutItem`, handling stackable count vs. multiple non-stackable copies.

**RNG stream choice.** Loot draws from the persistent **`gameplay`** stream — the one combat, AI, and
loot already share (`rng-and-determinism.md`) — so a run's drops are reproducible and part of the save.
Map-generation tables (the follow-up) will instead draw from generation's **derived, per-level**
streams, which is exactly why the table takes its RNG as input rather than owning one.

## 8. Follow-up — unification and other seams

- **Fold `stage-populate` onto tables** — replace `weightedItem` and the creature specs with entity
  tables (an item-population table and a spawn table). This is the roadmap's "unify" step. It **moves
  existing map-gen seeds**, so it wants its own reviewed change, and it requires the **generation entry
  points to call `useTables`** — the map-visualizer especially, since it doesn't boot through `main.js`.
- **Dropping carried inventory** on death (a creature's wielded spear/bow) is a separate, non-table
  concern; `onDeath` remains the seam for it, plus a corpse entity and death barks.
- **Scatter** — loot currently piles on the corpse tile (like repeated player drops). Scattering to
  adjacent free tiles is a later refinement.
- **Creature/furniture specs** — loot tables today emit item specs only; the spec vocabulary extends to
  creatures (for spawn tables) and furniture the same way, resolved by kind at the placement site.
