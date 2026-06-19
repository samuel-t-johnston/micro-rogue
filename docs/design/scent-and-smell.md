# Scent and Smell

Purpose: design and implementation plan for the smell sense (M6). Builds directly on the hearing
architecture ([sound.md](../howto/sound.md), [ai-senses.md](../howto/ai-senses.md)) and reuses its
patterns wherever possible.

---

## 1. The gameplay frame

Vision is the present + line-of-sight. Hearing is events + direction. **Smell is the temporal,
non-line-of-sight, identity sense** — what *was* here, what's near but unseen, and what *kind* of
thing it is. Its defining gameplay contribution:

**The player is a trackable emitter.** The player lays a scent trail, and creatures hunt it without
ever seeing the player. Vision tricks (corners, darkness) don't fool a nose — what beats a tracker is
**distance** (outrun until your scent decays below its threshold), **barriers** (scent doesn't
diffuse through walls — and, later, closed doors), and **masking** (deferred). Note this is *homing*,
not trail-retracing: the gradient peaks where you *are now*, so doubling back doesn't shake a
tracker. That's deliberate.

**Anti-clutter principle:** the scent field is *monster-facing data*. The player never sees a heatmap
in normal play — smell reaches the player only as occasional log cues and through how monsters
behave. A heatmap exists only as a debug overlay.

**Sensory crisscross (the showcase).** The first creatures exercise the senses in complementary ways:

| Emits | Smelled by player? | Heard by player? | Tracks via |
|---|---|---|---|
| **Player** — `scent('player')` | — | — | (is the prey) |
| **Scuttler** — *no scent*, noisy movement | no | yes ("scrabbling of vermin") | vision (3) + scent (player) |
| **Orc** — `scent('orcs')` | yes ("the stench of orcs") | yes (barks) | vision + hearing |

So in the **pillars maze** the player is hunted by scent (invisible to them) and warned by *sound*
(scrabbling); on the **orc floor** the player is warned by *smell* (stench) and *barks*. Each floor
foregrounds different senses.

---

## 2. The scent field + simple diffusion

State lives on the level: `level.scent` is a `Map<profile, Float32Array>`, each grid sized
`width × height` (index `y * width + x`), created lazily. A **profile** is a string identity; for
creatures it is the emitter's faction tag (see §4).

Once per player turn (§3), `scentUpkeep(level, registry)` runs, for each profile grid:

1. **Decay + gated blur, one double-buffered pass.** For each non-wall tile `c`:
   ```
   next[c] = ( grid[c] * (1 - SPREAD) + SPREAD * avgNeighbors(c) ) * DECAY
   ```
   `avgNeighbors(c)` sums the (up to 8) in-bounds, **non-wall** neighbors' values over a fixed
   denominator of 8 — wall neighbors contribute 0, so scent winds *around* pillars and never enters
   stone. Wall tiles are forced to 0. Cells below `EPSILON` snap to 0 (keeps the field sparse).
2. **Deposit.** For each `scentSource` on the level: `grid[profile][idx(pos)] += intensity` (capped
   at `MAX`). Deposit happens *after* decay so the source's current tile is always the strongest —
   giving homing toward a moving emitter and a fading trail behind it, plus a steady local cloud
   around a stationary one. One mechanism, both behaviors.

Starting constants (all tunable): `DECAY ≈ 0.85`, `SPREAD ≈ 0.20`, `intensity ≈ 10`, `MAX ≈ 100`,
`EPSILON ≈ 0.05`. Performance is a handful of grids × level tiles per round — trivial at our scale.

> **v1 barriers = walls only.** Closed doors (entities on floor tiles) do *not* block scent yet.
> Making a closed door a scent bulkhead (parallel to sound muffling) is deferred — same phase
> boundary as hearing.

---

## 3. Per-player-turn upkeep — a first-class concept

"Once per player turn, after the world has settled" is becoming a coordination hotspot (autosave
today; scent diffusion now; status-effect ticks, regeneration, weather later). Rather than bury each
new system in the game-scene `onTurnStart` closure or the turn manager, we promote it to a small
ordered registry: **`src/engine/upkeep.js`**.

```js
export const upkeep = {
  register(name, fn) { /* name-keyed, insertion-ordered */ },
  run(context) { /* runs steps in order: fn({ level, registry, player }) */ },
  reset() { /* new-game / test isolation, like gameLog.reset() */ },
};
```

- The game scene registers steps **in order** at game start: `'scent'` (diffusion) **before**
  `'autosave'`. Ordering is load-bearing now: **scent is saved** (§7), and the autosave fires in this
  same upkeep — so the field must be diffused *before* it's snapshotted, or a reload would lose a
  round of scent.
- `mountLevel`'s `onTurnStart` shrinks to: `if (playerControlled) upkeep.run({ level, registry, player })`.
  Steps read the **current** level from the run context, so level transitions need no special
  handling. Autosave stays a game-scene closure (it knows the cross-floor save shape); it's just
  *registered* as an upkeep step rather than called inline.

This is the documented extension point for "do X once per player turn."

---

## 4. Identity: profiles keyed by faction → reuse `areHostile`

A `scentSource` component carries `{ profile, intensity }`; for creatures `profile` is the faction
tag (`'player'`, `'orcs'`). Because grids are per-profile (and thus never cross-contaminate), a
tracker follows the gradient of any profile **hostile** to it via the existing
`areHostile(selfFactions, [profile])` — a scuttler homes on `'player'` and ignores allied scent. The
player, conversely, attends to profiles that aren't its own.

When several enemy scents are in range, the tracker follows the **strongest** this turn (it may
switch targets between turns). A committed, single-minded tracker that locks one scent is a deferred
refinement (§9).

`'blood'` / food and other non-faction profiles are deferred (§9); v1 ships only profiles with
emitters: `'player'` and `'orcs'` (scuttlers emit none — see §6).

---

## 5. The smell sense + the `smells` channel

`createSmellSense()` ([`src/ai/senses/smell.js`](../../src/ai/senses/smell.js)) reads `level.scent` at
the smeller's tile. Acuity is a `smell` component, `{ threshold }` — a keen nose has a *low*
threshold (senses fainter scent). For each profile whose local intensity ≥ `threshold`, it emits a
percept into a new channel:

```js
{ profile, direction, intensity }   // direction = steepest-ascent non-wall neighbor, or null at a peak
```

`SenseResult` becomes `{ entities, visibleTiles, sounds, smells }` (additive — existing senses just
don't set `smells`); `planning-context` gains a `mergeSmells` exactly like `mergeSounds`. As with
hearing, the sense reports *all* above-threshold profiles and goals do the filtering.

### Sense acuity is now uniform across all three senses

Smell completes a consistency pass: each sense reads an optional per-entity acuity component, so
range/sensitivity is creature data rather than a baked sense instance.

| Sense | Acuity component | Meaning | Default when absent |
|---|---|---|---|
| `vision` | `vision({ range })` | FOV radius | `undefined` → unlimited (today's behavior) |
| `hearing` | `hearing({ range })` | audible distance bonus | `0` → effectively deaf |
| `smell` | `smell({ threshold })` | min intensity sensed | (none) → no smelling |

`vision.js` is refactored to read `entity.components.get('vision')?.range` (undefined → unlimited),
so every existing creature is unchanged and the scuttler can opt into `range 3`.

---

## 6. Goals, text, and configurable "standout" scents

- **`track-scent`** ([`goals/track-scent.js`](../../src/ai/goals/track-scent.js)) — twin of
  `obey-shouts`, sits just below `chase-others`. Steps toward the strongest *hostile* scent's
  `direction`. **No memory** — the field is the persistence and it re-homes every turn. Returns null
  if no hostile scent or the step is blocked.
- **`player-smell`** ([`goals/player-smell.js`](../../src/ai/goals/player-smell.js)) — twin of
  `player-hear`. Logs cues for non-self profiles, deduped by profile so a lingering scent doesn't
  spam every turn.
- **`smell-text.describeSmell`** ([`src/engine/smell-text.js`](../../src/engine/smell-text.js)) —
  twin of `sound-text`.

**Configurable standout scents.** Not every scent is worth a log line. A profile → flavor map gates
it: a profile in the map is "loggable" with its phrase; one not in the map produces *no* player log.
v1: `{ orcs: 'the stench of orcs' }` → "You smell the stench of orcs to the north." Scuttlers emit no
scent at all, so they never log — instead they're **noisy**: their move sometimes emits a sound the
player *hears* (§6.1). This is the configurability lever the design asks for, kept in one small table.

### 6.1 Noisy movement (scuttlers route into hearing, not smell)

A `noisyMovement` component, `{ chance, volume, message }`, makes an entity sometimes announce itself
when it moves — realizing the original "moving while wearing noisy equipment" idea. `executeMove`
(threaded with `registry`) rolls `rng.random() < chance` after the move and, on success, `emitSound`
at the new tile (non-verbal, `language: null`, the component's `message`). The scuttler carries
`message: { kind: 'vermin-scrabble' }`; `sound-text` maps that kind to "the scrabbling of vermin,"
so the player's existing `player-hear` goal surfaces "You hear the scrabbling of vermin to the …".
Scuttlers are thus **silent to smell but loud to hearing** — a deliberate sensory inversion.

---

## 7. Serialization — scent is saved

Trails are gameplay state: a reload mid-hunt must not blank the field (a scuttler shouldn't briefly
"forget" you because you saved). So `level.scent` round-trips. `serializeLevel` emits it **sparsely**
(non-zero cells only, per profile: `{ profile: { "x,y": value } }`); `deserializeLevel` rebuilds the
dense grids, defaulting a missing `scent` to empty. Frozen floors carry their own scent (cold storage
already uses `serializeLevel`).

No save-version bump and no migration: an absent `scent` field defaults to empty grids, exactly the
backward-compatible pattern `deserializeLevel` already uses for `branch`/`depth`/etc.

---

## 8. The scuttler + the pillars maze

`createScuttler(registry, x, y)` — a beast, not a humanoid (no inventory/equipment/voice/knownLanguages):

| Component | Value |
|---|---|
| `health` | `2 / 2` (swarm fodder) |
| `attacker` | `1` |
| `faction` | `['scuttlers']` |
| `turnTaker` | speed `1.4` (above average — scuttles, harder to outrun) |
| `creature`, `blocksMovement` | — |
| `vision` | `{ range: 3 }` (myopic) |
| `senses` | `['vision', 'smell']` |
| `smell` | low `threshold` (keen tracker) |
| `noisyMovement` | `{ chance, volume, message: { kind: 'vermin-scrabble' } }` |
| `ai` | `['attack-adjacent', 'chase-others', 'track-scent', 'wander-aimlessly']` |
| `renderable` | glyph `s` |

The handoff is the point: in the open within 3 tiles it **sees and chases**; the instant you slip
behind a pillar and break its short line of sight, `chase-others` falls silent and **`track-scent`**
carries it around the pillar on your scent; adjacent, it bites. The 15×15 pillar lattice
(`data/maps/maze-pillars.js`) breaks LoS constantly, making scent the bridge — and the short
3-tile sight gives the player real room to use movement and the pillars to their advantage.

**Placement:** replace the three goblins in `maze-pillars.js` with **five scuttlers**; register
`scuttler` in the static-entity factory map (`stage-place-static-entities.js`). `maze-pillars` stays
in the random floor-2 rotation, so the swarm appears when that layout is rolled.

**Emitters/sensers added elsewhere:** the player gains `scent('player')`, the `smell` sense, a
`smell` component (a *high* threshold — only strong/near scent registers), and the `player-smell`
goal. Orcs and the orc commander gain `scent('orcs')` so the player smells them. Goblins are
untouched for now.

---

## 9. Deferred

- **Scent masking** — the counterplay half of "trackable." Suppress an emitter's deposit via a
  consumable (`scentMask` status) or water terrain (a tile that washes scent). Walls/distance are the
  only evasion in v1. *(Add to roadmap deferred list.)*
- **Single-minded tracker** — a tracker that commits to one scent and resists distraction by newer,
  stronger scents (memory of a chosen quarry), vs. v1's follow-the-strongest-each-turn.
- **Non-faction profiles** — `blood`, food, smoke as smellable world events (forensics/luring).
- **Doors block scent** — closed doors as scent bulkheads (parallels sound muffling v2).
- **Scent diffusion through real time on re-entry** — tied to the deferred re-entry pipelines.

---

## 10. Implementation plan (build order, TDD)

Shared contract change: `perception.smells` channel + `mergeSmells` (additive, mirrors `sounds`).

1. **Components:** `scentSource`, `smell`, `vision` (acuity), `noisyMovement`. Factory tests.
2. **Scent field module** (`src/world/scent.js`): create/size grids, `deposit`, `diffuseAndDecay`,
   `intensityAt`, `gradientDir`. Pure and fully TDD-able — deposit→diffuse spreads to open neighbors
   but not through walls; decay reduces over rounds; gradient points uphill; field stays sparse.
3. **Upkeep module** (`src/engine/upkeep.js`) + move autosave into it (scent step before autosave);
   wire `mountLevel.onTurnStart → upkeep.run`. Tests: ordered execution, reset.
4. **Vision acuity refactor** (`vision.js` reads the `vision` component; undefined → unlimited). Add
   a vision-range test; confirm existing creatures unchanged.
5. **Smell sense** + registry + the `perception.smells` merge in `planning-context`.
6. **Goals:** `track-scent`, `player-smell`; `smell-text` with the profile flavor map.
7. **Noisy movement:** `executeMove` threaded with `registry`, emits on the chance roll; `sound-text`
   gains the `vermin-scrabble` phrase.
8. **Scent serialization** in `serializeLevel`/`deserializeLevel` (sparse), with a round-trip test.
9. **Creatures/wiring:** `createScuttler`; player + orcs gain `scentSource`/`smell`; swap five
   scuttlers into `maze-pillars.js`; register `scuttler` in the static-entity factory.
10. **Docs + debug:** new `docs/howto/smell.md`; update `ai-senses.md`/`ai-architecture.md`/
    `creature.md`; tick the M6 smell box and add the deferred bullets to `roadmap.md`; a debug-overlay
    scent heatmap layer for development.
