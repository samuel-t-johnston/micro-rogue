# Secret Doors and Search

How **secret doors** and the **search** action work. A secret door is a tile indistinguishable from
wall until an entity reveals it by searching. The system rests on one idea — *terrain carries the
disguise, a dormant entity carries the door* — plus an active/passive search model and a few generation
stages that place secrets.

---

## 1. Gameplay frame

A secret door is a wall you can walk through once you've found it. Finding it is the point: search is a
low-cost, repeatable action whose payoff is access to space you otherwise can't reach. A secret door is
only interesting when it **gates something with no other entrance** — a hidden room, a shortcut, a
vault; a secret door in an already-reachable wall is just flavour.

Two properties define the feature:

- **Perfect disguise until revealed.** Unrevealed, a secret door is a wall in *every* channel —
  passability, line-of-sight, the "look" description, glyph/sprite/colour, fog-of-war memory, and the
  set of actions offered on the tile. No tell.
- **Reveal is global and permanent.** Once found, it is a door for everyone, forever (see §6).

---

## 2. Terrain carries the disguise

The tile at a secret door is genuine wall **terrain**; the secret door is a bare marker **entity**
sitting on that wall. The alternative — an entity on a floor tile that draws itself as a wall — founders
on line walls: the line-walls stage (`src/world/generation/stages/stage-line-walls.js`) computes each
wall's CP437 box-drawing glyph (`║ ╣ ╬ …`) from its four cardinal **tile** neighbours' `category`,
ignoring entities. An entity on a *floor* tile is not a wall-neighbour, so the surrounding wall glyphs
"open up" around it (a `╬` degrades to `╠`) and betray it at any corner or junction. With real wall
terrain, line walls glyphs the secret tile and its neighbours correctly, and the tile inherits the
district's wall id for free.

**The dormant entity carries only** `position`, `entityTypeId: 'secretDoor'`, and the `secret`
component (§4) — no `renderable`, `name`, `openable`, `blocksMovement`, or `opaque`. The terrain does
all the work, so every existing reader treats the tile as a wall with **zero special-casing**:

| Channel | Reader | Sees a wall because… |
|---|---|---|
| Passability | `level.isPassable` (`src/world/map/level.js`) | the tile's `blocksMovement` is true |
| Line-of-sight | `vision.js` (`src/ai/senses/vision.js`) | the tile is `opaque` |
| Rendering | `renderer.drawMap` | draws the wall tile; `drawEntities` skips the entity (no `renderable`) |
| Fog memory | `planning-context` / `drawRememberedEntities` | memory stores the wall tile id; the entity isn't `persistVisible` |
| "Look" text | `describe-tile.js` | no named occupant → falls through to `terrainPhrase` → "a wall" |
| Tile actions | `resolveTileActions` | no `openable` occupant, tile not passable → only "Look" is offered |
| AI / pathfinding | door goals, pathfinder | no `openable`, tile impassable → treated as wall |

So "appears as a wall in every way" costs nothing: the entity simply has no door components yet.

---

## 3. Reveal

`revealSecret(entity, level, registry)` (`src/world/entities/furniture.js`) turns a dormant secret into
an ordinary closed door:

1. Writes the floor id into `level.tiles[y][x]` (a plain array, serializes cleanly). The id is the
   `revealFloor` carried on the marker (§4).
2. Stamps the door components the entity lacked — the same set `createDoor` uses: `name`, `renderable`
   (`door-closed`), `openable`, `blocksMovement`, `opaque`, `persistVisible`.
3. Removes the `secret` component.

From that instant it is an ordinary closed door in every channel — the flanking wall glyphs run up to a
door in the line exactly as they do for a normally-placed door in a one-tile floor gap, with no re-run
of the line-walls stage. Reveal is idempotent: calling it on an already-revealed entity is a no-op.

---

## 4. The `secret` component

```js
// Marks an entity as an undiscovered secret disguised as terrain. While present, the entity carries
// none of its "real" components — the terrain beneath provides the disguise. `revealFloor` is the tile
// id written under the entity when it is found.
secret(revealFloor = 'floor') {
  return { revealFloor };
}
```

Presence of the component *is* "unrevealed"; reveal removes it (there is no `revealed` boolean, so no
revealed-but-still-tagged state a reader could mishandle). `revealFloor` is set by whoever places the
secret: a static map spec, the `secretDoors` stage (the floor the old door sat on), or the `secretRoom`
stage (the floor the door opens onto). The `secretDoor` prefab
(`src/world/entities/entity-prefabs.js`) builds the dormant entity; `revealSecret` is a standalone
helper, not tied to the door prefab, so future secret types (levers, illusory walls) can reuse it.

The component is purely additive, so it needs no save migration — an old save simply carries no `secret`
components and loads unchanged. Its only save-side footprint is a round-trip sample in
`serialize.test.js`'s component-codec guard.

---

## 5. Search

### Effectiveness

Search effectiveness scales with the searcher's **effective** INT (`getScore(entity, 'int')`, so
equipment like a ring of insight would count):

```
base = clamp(0.05 + 0.05 * INT, 0, 0.95)
```

applied per candidate secret by distance and mode:

| | Adjacent (8 tiles) | Distance 2 (16 tiles) |
|---|---|---|
| **Active** (full) | `base` | `base * 0.5` |
| **Passive** (half) | `base * 0.5` | `base * 0.25` |

Default INT is 1, so a starting character searches adjacent walls at 10% active / 5% passive, and
distance-2 at 5% / 2.5%. The 95% cap keeps a reveal from ever being certain in one action.

### One core, two callers

`performSearch(actor, level, registry, { passive, rng })` (`src/world/systems/search.js`) finds every
`secret` entity within Chebyshev distance 2, rolls `searchChance(int, distance, passive)` per candidate,
and reveals on success. It is actor-agnostic and does no logging. The roll uses a dedicated seeded
`search` RNG stream by default (injectable for tests), separate from the `gameplay` stream so search
rolls don't perturb other systems and survive save/load. Two callers share it:

- **Active** — `executeSearch` (`src/actions/action-types/action-search.js`), dispatched as the `search`
  action, consumes the turn. The core takes an arbitrary actor, though only the player invokes it today.
- **Passive** — a player-only `passive-search` step in the per-turn upkeep (`game-scene.js`), a
  half-strength sweep every turn. Being player-only keeps passive search off the whole creature roster.

### A self action, not a tile action

You search the area *around yourself*; you cannot target a wall you don't yet know is special. So Search
is offered on the player's own tile (like `Wait`), never as a per-tile row in `resolveTileActions` — a
"search here" affordance on a wall would leak the secret's location by its mere presence.

### Feedback

A successful active reveal logs "You discover a hidden door!"; an active search that finds nothing logs
"You search but find nothing." so the turn isn't a silent no-op. Passive discovery logs with a softer
verb ("You notice a hidden door!"); passive misses are silent (they happen every turn). The wording
lives in the two callers (the verb differs by mode) and currently hard-codes the noun "door" — correct
while every secret *is* a door; a second secret type would need the noun derived per revealed entity.

---

## 6. Reveal is global

Reveal is a global, permanent flip of shared state, not per-viewer. The disguise is a **shared terrain
tile**, so a per-viewer reveal would require per-viewer terrain, which the engine has no concept of.
Global reveal also means there's nothing to reconcile: an open secret door is a swapped tile plus a real
door, obvious to everyone by construction.

One consequence is **intended**, not a bug: a player who saw the disguised wall, then had it revealed
globally while it was out of view, keeps *remembering a wall* until they next see the tile — ordinary
fog-of-war behaviour that falls out of storing tile ids in memory.

---

## 7. Generation

Secrets reach a level three ways.

### Static placement

Static layouts (`data/maps/`) can author a `secretDoor` spec, placed by
`stage-place-static-entities.js`. The author owns the invariant: the tile is wall terrain, there is
floor on the far side, and (to be worth finding) that far side has no other entrance. The starting
level's hidden closet (`data/maps/floor-1-a.js`) is one.

### The `secretDoors` stage

`stage-secret-doors.js` (type `secretDoors`) converts *existing* closed doors into secret doors:
it removes the door entity, re-walls its tile (inheriting an adjacent tile's wall id, so it matches the
local district — stone vs. cave — regardless of the sticky palette), and drops a dormant `secretDoor`
whose `revealFloor` is the floor the door sat on.

It's a standalone stage rather than a parameter on the carve stages so that it runs **after all
carving**: a secret placed inline can be re-floored by a later carve (e.g. `stitch` digging through it
in `composite`), and a separate stage keeps the carve stages ignorant of secrets. Run it before
`lineWalls` so the re-walled tile joins the box-drawing mask. Pipelines opt in with
`{ type: 'secretDoors', chance, scope, bounds? }`.

- **`chance`** (0..1, default 0 — a no-op that draws no RNG).
- **`scope`** — `'redundant'` (default) or `'all'`:
  - `'redundant'` hides only doors on a loop. Redundancy is structural: a door is redundant iff, with
    it walled, its two floor sides still connect through other floor. Doors are processed in a fixed
    order and each conversion mutates the tiles, so redundancy is judged against the current *non-secret*
    graph — which guarantees a searchless path always remains to every region (it never disconnects the
    level and never forces a search).
  - `'all'` may seal a sole-access door, gating a region behind a search. The region stays reachable
    because a secret door is a **latent passage**, not a wall.
- **`bounds`** — restrict candidate doors to a sub-rect (e.g. one district); redundancy is still judged
  over the whole map.

A secret sealing one end of a corridor leaves a **suspicious dead-end** from the open side — an unforced
cue to search there. That tell naturally accompanies `'redundant'` secrets; an `'all'` secret on a
sole-access wall has no such hint, which is the point of the harder mode. Note a pure-BSP floor doors
only spanning-tree edges (its loops are door-less hall openings), so `'redundant'` finds little to hide
there — it's meaningful on `procedural-3x3` and on `stitch` joins.

Shipped on **floor-3** (`procedural-3x3`) at `scope: 'all', chance: 0.2` — that floor can hide the
amulet room or the sole up-stair behind a search (never a hard lock: a secret is always revealable by
searching the wall from the reachable side, and passive search rolls every turn).

The structural-connectivity flood in `data/pipelines/connectivity.test.js` treats a tile holding a
`secret` entity as walkable, so the invariant is "reachable, possibly by searching." It is asserted for
both scopes across the door pipelines: under `'all'`, every stair stays reachable via search *and* the
secrets genuinely gate (strand tiles when treated as plain walls); under `'redundant'`, every stair
stays reachable over floor alone.

### The `secretRoom` stage

`stage-secret-room.js` (type `secretRoom`) carves a tiny treasure room reachable *only* through a secret
door. The minimal room is a single floor tile holding a chest, cut from a 3×3 footprint: a 1×3 run of
existing wall (its middle tile becomes the secret door, opening onto adjacent floor) backed by a 2×3
block of untouched rock that becomes the room floor plus its wall shell.

```
. # ~ ~          . # # #
. # ~ ~    -->   . + = #      (. floor, # wall, ~ rock, + secret door, = chest)
. # ~ ~          . # # #
```

Four orientations (door faces N/E/S/W). "Rock" is an in-bounds wall tile — the stage never expands the
map or carves into existing floor, so the room is sealed except through the secret door. If no
orientation fits anywhere, no room is placed. The room floor and the door's `revealFloor` take the id of
the floor the door opens onto, so a room reveals stone off a stone corridor and cave off a cave one
without consulting the palette. Run after carving, before `lineWalls`.

Because the interior is one tile filled by the chest, the player can't stand *inside*: they search →
reveal the door → open it → step onto the now-open door tile → open the chest from there.

Parameters: `count` (rooms to attempt, default 1; placements never overlap), `contents` (chest loot as
prefab ids, default a healing potion + bread), `bounds` (district scoping). Shipped on the `composite`
branch-bottom floor. A larger interior (needing ≥3 aligned walls and an adjusted door position) is not
implemented.

---

## 8. What's verified

Unit tests cover the search formula (INT × distance × mode) and its determinism; reveal (tile becomes
floor, door components appear, `secret` clears, idempotent); the disguise through the public readers
(`isPassable` false, `describeTile` says "a wall", `resolveTileActions` offers only "Look", `vision`
opaque); the `secret` serialize round-trip; player-only passive search; and each generation stage
(placement geometry, scopes, `bounds`, `count`, determinism) plus the connectivity contract above.
Rendering — the wall in glyph and sprite mode, the door appearing on reveal — is checked by inspection.
