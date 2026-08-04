# Secret Doors and Search

Purpose: design and implementation plan for a **search** action and **secret doors** — entities that
are indistinguishable from wall terrain until an entity reveals them by searching. Establishes the
"terrain carries the disguise, a dormant entity carries the door" pattern, the active/passive search
model, and a phased path from static maps to procedural placement.

---

## 1. The gameplay frame

A secret door is a wall you can walk through once you've found it. Finding it is the point: search is a
low-cost, repeatable action whose payoff is access to space you otherwise can't reach. So a secret door
is only interesting when it **gates something with no other entrance** — a hidden room, a shortcut, a
vault. A secret door in an already-reachable wall is a no-op and should not be generated.

Two properties define the feature:

- **Perfect disguise until revealed.** Unrevealed, a secret door must be a wall in *every* channel —
  passability, line-of-sight, the "look" description, glyph/sprite/colour, fog-of-war memory, and the
  set of actions offered on the tile. No tell.
- **Reveal is global and permanent.** Once found, it is a door for everyone, forever (see §6).

---

## 2. The core decision: terrain carries the disguise

A secret door could be modelled two ways:

1. **Self-disguising entity** — an entity on a floor tile that draws itself as a wall and hides its own
   door-ness from every reader.
2. **Terrain + dormant entity** — real wall *terrain* at the tile, plus a bare marker entity that
   activates into a door only on reveal.

**We choose (2).** The deciding factor is line walls. The line-walls stage
(`src/world/generation/stages/stage-line-walls.js`) computes each wall's CP437 box-drawing glyph
(`║ ╣ ╬ …`) purely from its four cardinal **tile** neighbours' `category`, and it ignores entities
entirely. A secret-door entity sitting on a *floor* tile is therefore not a wall-neighbour: the real
walls around it drop their connection toward it, so at any corner/T/cross the surrounding wall glyphs
"open up" around the secret tile and betray it (a `╬` degrades to `╠`, etc.). The entity would also have
to re-derive the district palette (`src/world/generation/palette.js`) *and* re-run the line-wall mask
just to pick its own glyph — duplicating two generation stages.

If the tile is genuinely wall terrain, all of that is free: line walls glyphs the secret tile *and* its
neighbours correctly, and it inherits the district's wall id from the palette.

### What "dormant" buys us

While hidden, the marker entity carries **only** `position`, `entityTypeId: 'secretDoor'`, and its
secret state (§4). It has **no** `renderable`, `name`, `openable`, `blocksMovement`, or `opaque`. The
*terrain* does all the work, and every existing reader treats the tile as a wall with **zero
special-casing**:

| Channel | Reader | Sees a wall because… |
|---|---|---|
| Passability | `level.isPassable` (`src/world/map/level.js`) | the tile's `blocksMovement` is true |
| Line-of-sight | `vision.js` (`src/ai/senses/vision.js`) | the tile is `opaque` |
| Rendering | `renderer.drawMap` | draws the wall tile; `drawEntities` skips the entity (no `renderable`) |
| Fog memory | `planning-context` / `drawRememberedEntities` | memory stores the wall tile id; the entity isn't `persistVisible` |
| "Look" text | `describe-tile.js` | no named occupant → falls through to `terrainPhrase` → "a wall" |
| Tile actions | `resolveTileActions` | no `openable` occupant, tile not passable → only "Look" is offered |
| AI / pathfinding | door goals, pathfinder | no `openable`, tile impassable → treated as wall |

This is the whole reason to prefer terrain: the "appears as a different entity in every way"
requirement collapses from *"teach every perception site to ignore an unrevealed secret"* into *"the
entity simply has no door components yet."*

---

## 3. Reveal

Revealing a secret door, given the marker entity `e` at `(x, y)`:

1. Swap the terrain to the district floor: write `level.tiles[y][x] = <floor id>` (a plain array, so it
   serializes with no codec — prefer this over `level.overrides`, which is a `Map`). The floor id is
   captured at generation time and stored on the marker (§4), since the reveal site doesn't know the
   palette.
2. Add the door components the dormant entity was missing — the same set `createDoor`
   (`src/world/entities/furniture.js`) stamps: `name`, `renderable` (`door-closed`), `openable`,
   `blocksMovement`, `opaque`, `persistVisible`.
3. Clear the secret state (or flip `revealed: true`).

From that instant it is an ordinary closed door in every channel — including that the flanking wall
glyphs now run up to a door in the line, exactly as they already do for a normally-placed door (which
sits in a one-tile floor gap). No re-run of the line-walls stage is needed.

Reveal is idempotent and safe to call on an already-revealed door (no-op).

---

## 4. Data model

A single component marks the secret and carries what reveal needs. Add to
`src/world/entities/components.js` (alphabetical order) and register a round-trip sample in
`serialize.test.js`:

```js
// Marks an entity as an undiscovered secret disguised as terrain. While present, the entity carries
// none of its "real" components (name/renderable/openable/…) — the terrain beneath provides the
// disguise (see docs/design/secret-doors-and-search.md). `revealFloor` is the tile id to write when
// the secret is found (captured at generation from the district palette, since reveal doesn't see it).
secret(revealFloor = 'floor') {
  return { revealFloor };
},
```

Presence of the component *is* "unrevealed"; reveal removes it. A boolean `revealed` flag is avoided so
there is never a revealed-but-still-tagged state for readers to mishandle.

A `secretDoor` prefab in `src/world/entities/entity-prefabs.js` makes the dormant entity (position +
`entityTypeId` + `secret`). Reveal is a small helper (`revealSecret(entity, level, registry)`) rather
than living in the door prefab, so future secret entity types (secret levers, illusory walls) reuse it.

**Save impact: no `saveVersion` bump, no migration.** The `secret` component is a purely *additive*
optional field, which `docs/design/save-system-design.md` (Versioning) explicitly says does not bump
the schema. The bar for a migration is *existing saved data that must change or be backfilled* — e.g.
the v12→v13 `food` migration retroactively tagged edibles already in a player's inventory. A secret
door has nothing to backfill: no entity in an old save should become one (secrets only exist on
freshly-generated floors), and the hidden closet can't be injected into a floor whose tiles are already
frozen. An old save loads fine — it simply carries no `secret` components. The one save-side obligation
is the round-trip sample for `secret` in `serialize.test.js`'s component-codec guard, which ships with
the component.

---

## 5. Search

### 5.1 Effectiveness

Search effectiveness scales with the entity's **effective** INT (`getScore(entity, 'int')`, so
equipment like a future ring of insight counts):

```
base = clamp(0.05 + 0.05 * INT, 0, 0.95)
```

Applied per candidate secret by distance and mode:

| | Adjacent (8 tiles) | Distance 2 (16 tiles) |
|---|---|---|
| **Active** (full) | `base` | `base * 0.5` |
| **Passive** (half) | `base * 0.5` | `base * 0.25` |

Default INT is **1**, so a starting character searches adjacent walls at 10% active / 5% passive, and
distance-2 at 5% / 2.5%. The 95% cap means secrets are never a certainty in one action.

### 5.2 One core, two callers

A single `performSearch(entity, level, registry, { passive })` finds every entity with the `secret`
component within Chebyshev distance 2, rolls the appropriate chance per candidate against the shared
seeded RNG (`src/rng.js` — never `Math.random`), and reveals (§3) on success. This mirrors the
"single source of truth" ethos of `resolveTileActions`: active and passive can't drift.

- **Active** — a new `src/actions/action-types/action-search.js`, dispatched by the action system,
  consuming the turn. Designed to be usable by any entity (the search core takes an arbitrary actor),
  though only the player invokes it initially.
- **Passive** — an `upkeep.js` step. `upkeep` already runs **player-only**, which conveniently keeps
  passive search off the whole creature roster — avoiding both the RNG churn and the determinism
  question of rolling for every actor each turn. Order the step deterministically among the existing
  upkeep steps (RNG-consuming, so its position is load-bearing for reproducible seeds).

### 5.3 Search is a self/area action, not a tile action

You search the area *around yourself*; you cannot target a wall you don't yet know is special.
Therefore:

- Active search is a **self action** (like `Wait`) surfaced on the player's own tile / a HUD control —
  **not** a per-tile row in `resolveTileActions`.
- The contextual menu on a wall must **never** gain a "search here" affordance; that would leak a
  secret's location by its mere presence.

### 5.4 Feedback

On a successful reveal, log a player-facing line ("You discover a hidden door!"). On active search with
no discovery, a neutral line ("You find nothing.") so the turn isn't a silent no-op. Passive discovery
also logs, with a softer verb ("You notice a hidden door!"); passive *misses* are silent (they happen
every turn).

**Known coupling to unwind when a second secret type lands.** The discovery wording is intentionally
kept in the two *callers* (the active action and the passive upkeep step) rather than in
`performSearch`, because the verb differs by mode ("discover" vs "notice") and player-facing text
doesn't belong in the player-agnostic core. The cost is that both callers currently hard-code the noun
**"door"** — fine while every secret *is* a door, but the moment a second type exists (a hidden chest?),
both messages produce wrong text. At that point, derive the noun per revealed entity (e.g. from its
post-reveal `name`, or a label on the `secret` marker) and share that between the two callers. Both
sites carry a `NOTE:` comment pointing here.

---

## 6. Why reveal is global, not per-entity

Per-entity reveal was considered (it would avoid oddities like a creature immediately opening a door the
player just found). It's rejected because the disguise is a **shared terrain tile**: hiding it
per-viewer would require per-viewer terrain, which the engine has no concept of. Global reveal also
dissolves the contradiction the per-entity model was meant to solve — an open secret door is a swapped
tile plus a real door, obvious to everyone by construction, with nothing to reconcile.

A consequence worth stating as **intended**, not a bug: a player who saw the disguised wall, then had it
revealed globally while it was out of view, keeps *remembering a wall* until they next see the tile —
fog-of-war behaviour that falls out of storing tile ids in memory. That's correct.

---

## 7. Placement — phased

### Phase 1: static maps (first cut)

Support a `secretDoor` spec in static layouts (`data/maps/`, placed via
`stage-place-static-entities.js`). The author is responsible for the invariant a generator would later
enforce: the tile is wall terrain, there is floor on the far side, and that far side has no other
entrance. This proves out the component, reveal, the search core (active + passive), rendering, "look",
save/migration, and feedback — end to end — with no generation work.

### Phase 2: a dedicated `secretDoors` stage (built)

Rather than a `secretDoorChance` param smeared across every door-placing stage, secret doors are a
**post-carve stage** (`stage-secret-doors.js`, type `secretDoors`) that converts *existing* closed
doors into secret doors: it removes the door entity, re-walls its tile (inheriting the wall of an
adjacent tile, so it matches the local district — stone vs. cave — regardless of the sticky palette),
and drops a dormant `secretDoor` whose `revealFloor` is the floor the door sat on.

Why a stage and not a per-stage param: inline placement in a carve stage is fragile — in a composed
pipeline a *later* carve (e.g. `stitch` in `composite`) can dig straight through a just-placed secret's
wall tile and re-floor it, breaking the disguise. A stage that runs **after all carving** (and before
`lineWalls`, so the re-walled tile joins the box-drawing mask) can't be undone, works for every pipeline
uniformly, and keeps the carve stages ignorant of secrets. Pipelines opt in by adding
`{ type: 'secretDoors', chance, scope, bounds? }` where they want it — composable, and `bounds` scopes
it to one district of a composite level.

Parameters:
- `chance` (0..1, default 0 — a no-op that draws no RNG, so existing pipelines are byte-identical).
- `scope`: `'redundant'` (default) or `'all'`. Both are supported because both have uses — a
  shortcut-hiding pass vs. a gate-the-region pass.
- `bounds`: optional sub-rect; candidate doors are restricted to it, but redundancy is judged over the
  whole map (an alternate route through another district still counts).

**Redundancy is structural**, computed by the stage itself (no per-stage bookkeeping): a door is
redundant iff, with it walled, its two floor sides are still connected through other floor. Doors are
processed in a fixed order and each conversion mutates the tiles, so redundancy is judged against the
current *non-secret* graph — which guarantees `'redundant'` scope never removes the last searchless path
to any region (so it never disconnects the level and never forces a search). `'all'` scope may seal a
sole-access door, gating a region behind a search; the region stays reachable because a secret is a
**latent passage**.

*Note the `'redundant'` asymmetry:* a pure-BSP floor doors only spanning-tree edges (its loops are
door-less hall openings), so `'redundant'` scope finds little to hide there — it's meaningful on
procedural-3x3 and on `stitch` joins. That's expected, not a bug.

**Connectivity contract.** `data/pipelines/connectivity.test.js`'s flood treats a tile holding a
`secret` entity as a latent passage (walkable), so the invariant becomes "reachable, possibly by
searching." The tests assert both: under `'all'`, every stair stays reachable via search *and* the
secrets genuinely gate (strand tiles when treated as plain walls); under `'redundant'`, every stair
stays reachable over **floor alone** (no search ever required).

**Dead-end tutorialization.** A secret hidden inside a corridor seals one end; from the open end the
passage reads as a suspicious dead-end — an obvious, unforced cue to search there. This tell naturally
accompanies `'redundant'` secrets (reachable from the open side); an `'all'` secret on a sole-access
wall has no such hint, which is the point of the harder mode.

### Phase 3: secret rooms (later)

Dedicated stages that carve a room reachable *only* through a secret door — the payoff case from §1.
Out of scope for now; noted so the earlier phases don't foreclose it.

---

## 8. Testing

Per the project's test-first rules for pure logic and RNG-consuming code:

- **`performSearch` effectiveness** — table-driven over INT × distance × mode against the documented
  formula; determinism asserted from a fixed seed.
- **Reveal** — after reveal, the tile is floor, the entity has door components and lost `secret`, and
  the door opens/closes normally; idempotent on a second call.
- **Disguise** — an unrevealed secret door reads as a wall through the public readers: `isPassable`
  false, `describeTile` says "a wall", `resolveTileActions` offers only "Look", `vision` treats the
  tile as opaque.
- **Save round-trip** — the `secret` component survives serialize/deserialize (its sample in
  `serialize.test.js`'s component-codec guard). No migration test: the change is purely additive (see §4).
- **Passive search** — the upkeep step reveals over turns for the player and does not roll for other
  creatures.
- **`secretDoors` stage** — `chance` 0 is a no-op that draws no RNG; `'redundant'` converts loop doors
  but keeps a searchless path and never touches a sole-access door; `'all'` seals a sole-access door; a
  conversion leaves wall terrain + a dormant secret whose `revealFloor` is the old floor; `bounds`
  restricts candidates; deterministic for a seed. Plus the connectivity contract above, asserted over
  the real door pipelines (bsp, composite, procedural-3x3) for both scopes.

Rendering (the wall looking right in glyph + sprite mode, and the door appearing on reveal) is verified
by inspection, not snapshot tests, per the testing guidance.
