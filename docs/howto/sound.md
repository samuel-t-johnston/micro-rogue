# Sounds, Hearing, and Barks

*How sound works in the engine: emitting sounds, hearing them, and using vocalizations as a creature comms channel. For the sense plumbing see [ai-senses.md](ai-senses.md); for the decay/turn integration see [turn-order.md](turn-order.md).*

## The model

A **sound** is an invisible, short-lived entity — three components and nothing else:

| Component | Role |
|---|---|
| `position` | where the sound was emitted |
| `sound` | `{ sourceId, volume, language, message }` |
| `decay` | `{ lifespan }` — turns until it's destroyed |

It has no `renderable` (invisible), no `blocksMovement`, and crucially no `creature` (it must not read as an actor) and no `turnTaker` (it doesn't act). The turn loop ages `decay` entities one tick per round and destroys them at 0 — see [turn-order.md](turn-order.md).

- **`volume`** extends how far the sound carries: a hearer perceives it within `hearing.range + volume`.
- **`language`** is the vocalization's language (`null` for non-verbal noise like a clang or scream).
- **`message`** is structured semantics the AI acts on — e.g. `{ kind: 'enemy-report', direction: 'NW' }`. Never free text; the player-facing string is *derived* from the message ([`sound-text.js`](../../src/engine/sound-text.js)).

## Emitting a sound

Sounds are generated **explicitly by actions** — there's no ambient emission. The single creation site is [`emitSound`](../../src/world/sounds.js):

```js
emitSound(registry, level, { sourceId, x, y, volume, language, message, lifespan });
```

The built-in producer is the **`shout` action** ([`action-shout.js`](../../src/actions/action-types/action-shout.js)): it emits a sound at the actor's tile, stamped with the actor's `voice` language. No `voice` (or a silenced actor) → no sound, but the turn is still spent. A goal builds the action: `{ type: 'shout', volume, message, lifespan }`.

Two more producers emit the same way: **noisy movement** (the scuttler's scrabble — a `noisyMovement` component checked in `executeMove`) and a **combat clash** on every `attack`. Each sound also snapshots the emitter's **`sourceFactions`** at emit time, so a hearer can recognize and ignore allies — except the combat clash, emitted faction-neutral, since a fight is worth investigating whoever's swinging. (The player only logs a heard sound whose origin tile it *can't* currently see — no "you hear fighting" for a brawl in plain view.)

## Hearing a sound

A creature hears if it has the `hearing` sense (in its `senses` list) and a `hearing` component for acuity (range). The sense reports **located noise percepts** into `context.perception.sounds` — never entities, never exact positions:

```js
{ soundId, sourceId, message, language, understood, perceivedDirection, distance, confidence, turnObserved }
```

`perceivedDirection` is an 8-way compass bearing; `understood` is whether the hearer's `knownLanguages` decode the sound's `language` (non-verbal = always understood). Goals consume these as uncertain leads.

## Worked example: the orc bark loop

1. **Commander spots the player.** Its `shout-enemy-report` goal (top of its stack) sees a hostile via `vision`, and on the *first* sighting emits a `shout`: `message = { kind: 'enemy-report', direction: <bearing to the foe> }`, language `orcish`. It records the enemy as reported (in memory) so it shouts once, then falls through to its combat goals.
2. **Nearby orcs hear it.** Their `hearing` sense surfaces the percept; because they have `knownLanguages: ['orcish']`, `understood` is true.
3. **Orcs converge.** Their `obey-shouts` goal (below chase/attack) reads the understood `enemy-report`, sets a heading, and steps in that direction — persisting for a few turns so they keep moving between shouts.
4. **Vision takes over.** Once an orc sees the player, `chase-others`/`attack-adjacent` (higher priority) fire and `obey-shouts` goes quiet.
5. **The player hears it too** — but knows no orcish, so the `player-hear` goal logs *"You hear guttural orcish shouting to the …"* (the perceived direction), not the meaning.

Because comprehension is just `knownLanguages` ∩ `sound.language`, the levers come for free: **deafen** = drop `hearing`; **silence** = drop `voice`; **translate / learn orcish** = add to the player's `knownLanguages` (then the log starts decoding the message, and a player `shout` could spoof orders).

## Deferred

- **Propagation.** v1 audibility is straight-line (Chebyshev) range — it hears through walls. Walking-distance propagation (a `muffling` component: walls block, doors/boulders leak at higher path cost; weighted flood-fill) is a planned upgrade entirely inside [`hearing.js`](../../src/ai/senses/hearing.js); it changes no percept shape.
- **Echolocation.** A precise, exact-tile hearing variant is deliberately separate from ordinary (imprecise) hearing — see the deferred list in [roadmap.md](../design/roadmap.md).
