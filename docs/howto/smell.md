# Smell and Scent

*How smell works in the engine: the scent field, emitting and tracking scent, and the player as a trackable emitter. For the sense plumbing see [ai-senses.md](ai-senses.md); for the full design and rationale see [scent-and-smell.md](../design/scent-and-smell.md).*

## The model

Smell is **field-based and monster-facing**. A per-profile **scent field** lives on the level — `level.scent`, a `Map<profile, Float32Array>`, one cell per tile — managed by [`src/world/sense-systems/scent.js`](../../src/world/sense-systems/scent.js). The player never sees it (except via the debug heatmap); they experience smell only through occasional log cues and through how monsters behave.

Each round the field is **diffused and decayed**, then every scent source re-deposits at its current tile:

- A **moving** emitter leaves a fading trail behind it, and the gradient peaks where it *is now* (homing).
- A **stationary** emitter builds a local cloud.
- Scent is blocked by **walls** (it winds around pillars, never through stone). v1 ignores doors; closed-doors-block-scent is deferred.

Because the gradient homes on the current position, **doubling back doesn't shake a tracker** — what beats it is distance (outrun until the scent at the tracker decays below its threshold), putting walls between you, or masking (deferred). This is deliberate.

## Components

| Component | Role |
|---|---|
| `scentSource` | `{ profile, intensity }` — deposits scent each round. `profile` is the scent's identity; for creatures it's the faction tag, so trackers can use `areHostile`. |
| `smell` | `{ threshold }` — smell acuity. A *low* threshold is a keen nose; no component means no smell. Pairs with the `smell` sense in the `senses` list. |

## Emitting and tracking

Emission is automatic: any entity with a `scentSource` deposits each round in the **per-player-turn upkeep** ([`src/engine/turn/upkeep.js`](../../src/engine/turn/upkeep.js)). No per-move hook — a stationary creature still smells. (The upkeep registry is the general home for "once per player turn" world updates; scent diffusion is registered there, ordered before the autosave so a reload restores a current field. The field is saved with the level, sparsely.)

The `smell` sense reports **located scent percepts** into `context.perception.smells` — never entities, never exact positions:

```js
{ profile, direction, intensity }   // direction = 8-way gradient toward the source, or null on a peak
```

The [`track-scent`](../../src/ai/goals/track-scent.js) goal filters to profiles **hostile** to the creature and steps up the strongest one's gradient. It needs no memory — the field is the persistence, re-homing every turn. It sits below chase/attack, so once the quarry is *seen*, those higher goals take over.

## Worked example: the scuttler swarm

`createScuttler` is a fast, weak (2 HP) beast with **3-tile vision** and a keen nose. In the pillars maze (`data/maps/maze-pillars.js`, where five of them replace the goblins):

1. **In the open**, within 3 tiles, it sees the player and `chase-others` drives it in.
2. **Behind a pillar**, line of sight breaks, `chase-others` goes quiet, and `track-scent` carries it around the pillar on the player's scent.
3. **Adjacent**, it bites.

The player is a `scentSource('player')`, so the swarm hunts them through the lattice. Scuttlers themselves emit **no** scent — but they're noisy: a `noisyMovement` component sometimes emits a sound on the move, so the player *hears* "the scrabbling of vermin" closing in (see [sound.md](sound.md)). A sensory inversion: silent to smell, loud to hearing.

## The player's nose

The player has the `smell` sense with a *dull* threshold — only strong, near scent registers. The [`player-smell`](../../src/ai/goals/player-smell.js) goal logs notable scents ("You smell the stench of orcs to the north"), deduped by profile. **What's noteworthy is configurable**: [`smell-text.js`](../../src/engine/log/smell-text.js) holds a profile→flavor table, and a profile with no entry produces no line (orcs reek; scuttlers don't register — they're heard, not smelled).

## Debugging

Toggle the debug overlay (`` ` ``), then **`3`** for the scent heatmap (each profile a distinct hue, alpha by intensity) and **`4`** for the sound layer (markers + volume rings on the otherwise-invisible sound entities). Watching the heatmap while a scuttler chases you is the quickest way to sanity-check tuning.

## Deferred

Scent masking (water/consumables), single-minded trackers, non-faction scents (`blood`, food), and doors-block-scent — see [scent-and-smell.md](../design/scent-and-smell.md) and the roadmap's deferred list.
