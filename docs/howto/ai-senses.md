# AI Senses

*How entities perceive the world, and how to add a new sense. (The sense system is deliberately minimal so far — see the limits below.)*

For the intended full design (hearing, smell, darkvision, confidence-weighted merging), see [ai-architecture.md](../design/ai-architecture.md). This doc covers what exists today.

## How it works

An entity's `senses` component is an ordered list of string keys, resolved through [`src/ai/senses/sense-registry.js`](../../src/ai/senses/sense-registry.js). Each sense is a function:

```js
sense(entity, level, turnCount) → SenseResult
```

A `SenseResult` is `{ entities, visibleTiles, sounds, smells }`, where each observed entity carries `{ entityId, position, confidence, turnObserved, factions, tags }` and `tags` includes `isActor` / `isPlayer`. `sounds` and `smells` are optional (omit them and they default to empty); see [Hearing](#hearing-and-the-sounds-channel) and [Smell](#smell-and-the-smells-channel).

[`planning-context.js`](../../src/ai/core/planning-context.js) runs every sense each turn, merges the results (highest confidence wins on conflict), updates the entity's `tilePerception`, and exposes the merged view as `context.perception` to goals ([ai-goals.md](ai-goals.md)). **Planners never read the world directly — only what senses report.**

| Sense | Source | Behaviour |
|---|---|---|
| `vision` | [`vision.js`](../../src/ai/senses/vision.js) | Shadowcasting FOV; a tile blocks sight if its type is `opaque` or it holds an `opaque` entity. Full detail on what's seen. |
| `hearing` | [`hearing.js`](../../src/ai/senses/hearing.js) | Reports **sounds**, not entities — see below. Acuity (range) comes from the hearer's `hearing` component; a sound is audible within `range + sound.volume`. v1 uses straight-line distance (no occlusion). |
| `smell` | [`smell.js`](../../src/ai/senses/smell.js) | Reports **scents**, not entities — see below. Reads the per-profile scent field on the level; acuity (a detection `threshold`) comes from the `smell` component. Gives a gradient direction toward the source, not a position. |
| `mega-vision` | [`mega-vision.js`](../../src/ai/senses/mega-vision.js) | Perfect perception — the complete world state, every positioned entity, no FOV or light gating, confidence 100. **Not currently used by any entity** (the player and NPCs all use `vision`); kept as a debugging tool and a candidate sense for future very powerful creatures. |

### Current limits

- `vision`, `hearing`, and `smell` are in use; `mega-vision` is implemented but unused (see the table). Darkvision is designed but not built.
- `confidence` is always `100`; the confidence-weighted reasoning the merge supports isn't exercised yet.
- `vision` gates on tile **opacity** only — there is no light-level check yet.
- **Tile data is a known deviation:** pathfinding reads `context.level` directly rather than a sense-filtered "known map" (tracked in ADR-021).

## Hearing and the sounds channel

Hearing is fundamentally unlike the sight senses: it reports **no entities and no visible tiles** — it surfaces *sounds* into the `SenseResult`'s `sounds` array, which `planning-context.js` collects into `context.perception.sounds`. A sound percept is an **imprecise lead**, never an entity sighting:

```js
{ soundId, sourceId, message, language, understood, perceivedDirection, distance, confidence, turnObserved }
```

- **`perceivedDirection`** is an 8-way compass direction (`'N'`…`'NW'`), not a position — hearing tells you roughly *where from*, not *where*.
- **`message`** is the sound's structured semantics (e.g. `{ kind: 'enemy-report', direction: 'NW' }`) — goals act on this, never on parsed text.
- **`understood`** is whether the hearer's `knownLanguages` decode the sound's `language` (non-verbal sounds are always understood). A goal can require `understood` before obeying; the player UI shows un-understood vocalizations as untranslated noise.

Sounds are emitted as invisible, short-lived entities (`sound` + `decay` + `position`) via [`emitSound`](../../src/world/sense-systems/sounds.js), explicitly from actions (the `shout` action). The turn loop ages `decay` entities and destroys them — they do **not** need a `turnTaker` (and must not have `creature`, or they'd read as actors). See the [sound & hearing how-to](sound.md) for the full flow and the bark example.

Propagation is straight-line range for now; walking-distance + `muffling` (walls block, doors leak) is a planned upgrade internal to `hearing.js` that doesn't touch this contract.

## Smell and the smells channel

Smell is the field-based, monster-facing sense. A per-profile **scent field** lives on the level (`level.scent`, see [`scent.js`](../../src/world/sense-systems/scent.js)): creatures with a `scentSource` deposit each round, and the field diffuses + decays — so the gradient homes on where an emitter *is now*, with a fading trail behind a moving one. The `smell` sense digests the smeller's local field into the `smells` channel:

```js
{ profile, direction, intensity }   // direction = gradient toward the source, or null on a peak
```

- **`profile`** is the scent's identity — a faction tag for creatures — so a tracker follows hostile profiles via `areHostile`.
- **`direction`** is the 8-way step up the gradient (what `track-scent` walks); **`intensity`** is the local strength.
- Acuity is the `smell` component's `threshold` — a keen nose has a *low* threshold; no component means no smell.

Diffusion runs once per player turn in the [upkeep registry](../../src/engine/turn/upkeep.js), and the field is **saved** with the level. See the [smell & scent how-to](smell.md) for the full flow and the scuttler example.

## Add a new sense

1. Write the function (or a factory returning one) in `src/ai/senses/`, returning a `SenseResult` in the shape above.
2. Register it in the map in [`src/ai/senses/sense-registry.js`](../../src/ai/senses/sense-registry.js). (`registerSense(name, fn)` also exists, used for test doubles.)
3. Add the name to an entity's `senses` component (see [creature.md](creature.md)).

## Worth knowing

- **Senses are the abstraction boundary.** Blinding, deafening, or confusing a creature is just disabling or corrupting a sense — no special-casing in goals.
- **`isActor` vs `isPlayer` tags** let goals distinguish creatures from inert scenery/items (an actor has a `creature` component — kept separate from `turnTaker`, which is only about turn order); hostility itself is decided from `factions` via `areHostile` (see [`factions.js`](../../src/combat/factions.js)).
- **Shape stability matters.** New senses must return the same `SenseResult` shape so the merge and goals need no changes.
