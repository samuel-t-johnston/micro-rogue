# AI Architecture: Senses, Memory, and Goal Planning
Purpose: Initial AI design overview for ROGµE.

## Inspiration: FEAR's AI Paper

NPC behavior is built on a GOAP (Goal-Oriented Action Planning) foundation, inspired by "Three States and a Plan: The A.I. of F.E.A.R." The turn-based nature of the roguelike is an advantage over real-time — the planner can run a proper action-space search each turn without frame budget concerns. Full GOAP is reserved for elite enemies; fodder uses simpler reactive behavior via the same component structure, with no structural difference between them.

---

## Senses

Each creature has a `senses` array of components. Each sense is a filtered world-state query:

```
sense(entity, world) → SenseResult
```

The AI planner never reads the map directly — only what senses report. This means blinding, deafening, or confusing a creature is just disabling or corrupting a sense component, with no special-casing needed.

### Sense Types

**Mega-vision** — Returns the complete world state: all entities, their exact positions, and component tags. Confidence is always 100; no FOV or light gating. Originally the bootstrap sense for the player and early AI development; now that real `vision` is implemented, **nothing uses mega-vision** — it is retained as a debugging tool and a candidate sense for future very powerful creatures (perfect awareness as a stat). Same `SenseResult` shape as every other sense, so it drops onto any entity with no planner changes.

**Vision** — FOV algorithm (e.g. shadowcasting) gated by per-tile light level. Full detail on observed entities: exact position, appearance, visible equipment.

**Darkvision** — Same FOV algorithm, skips light check. Silhouette-level detail rather than full.

**Hearing** *(implemented)* — Sounds are emitted into the world as short-lived entities (position, volume, language, structured message), and entities with a `hearing` component perceive those within `range + volume`. Hearing reports **located noise percepts**, not entity sightings: an imprecise compass **direction**, the structured message, and whether the hearer understands its language — never exact coordinates. Percepts land in a dedicated `perception.sounds` channel, separate from entity sightings, and drive direction-based investigate/obey behaviour. (v1 propagation is straight-line; walking-distance attenuation by walls and muffling furniture is a planned internal upgrade. The exact-position variant is deliberately *not* hearing — see Echolocation in the roadmap's deferred list.)

**Smell** *(implemented)* — Field model. A per-profile **scent field** lives on the level; creatures with a `scentSource` deposit each round, and the field diffuses + decays, so the gradient homes on an emitter's *current* tile with a fading trail behind a moving one. The `smell` sense reports a gradient **direction + profile + intensity** into a `perception.smells` channel — no entities, no exact position — and trackers (e.g. the eyeless-ish scuttler) climb the gradient. Diffusion runs in the per-player-turn upkeep registry and the field is saved with the level. The player is a `scentSource` too, so scent-hunters track the player *without seeing them* — the centerpiece of the feature.

### Information Quality

Different senses yield different quality of information:

| Sense | Position | Entity type | Detail | Notes |
|---|---|---|---|---|
| Mega-vision | Exact | Full | Complete | No filtering; entire world state |
| Vision | Exact | Full | High | Blocked by opaque tiles and darkness |
| Darkvision | Exact | Silhouette | Medium | Blocked by opaque tiles, ignores light |
| Hearing | Approximate | Type hint | Low | Passes around corners, muffled by walls |
| Smell | Direction only | Profile (faction) | Low | Field gradient; homes on the emitter's current tile |

An approximate position is represented as a radius of uncertainty rather than a point. The AI can still act on low-quality information — a creature that hears something can pursue a `investigate` goal toward an uncertain position without knowing exactly where the player is.

### Merging Into World State

Sense results are merged into world-state facts each turn before planning. Where senses conflict, higher-quality data wins. Reported entity positions carry confidence metadata:

```javascript
{ position, confidence, turnObserved }
```

This lets the AI reason about stale data — a position seen 10 turns ago is less reliable than one seen this turn. *(Implemented: `turnObserved` is stamped from the perceiver's per-entity clock, `turnTaker.actCount` — the same clock memory staleness uses. It was previously always 0, so any time-based reasoning was dead until this landed.)*

---

## Memory

Memory is separate from sense results. Rather than caching all perception, only data that **drove a decision** is retained. Goals should clear keys they own when the condition that activated them resolves.

### Entity-Level Shared Memory

Memory lives on the entity as a flat key-value store (`memory` component). All of an entity's goals read and write it freely. Goals may also mutate memory during evaluation as a side effect even when not activating — for example, a goal clearing its target key when a cancel condition fires.

Shared memory is the right model for the player, where goals explicitly coordinate through state: `player-get-input` writes `autoMoveTarget`; `player-auto-move` reads and eventually clears it. Goal-owned memory with cross-goal writes creates reach-in coupling that shared memory avoids.

### Memory Decay *(partly realized)*

The first NPC goal with an independent memory lifecycle is here: `investigate` forgets a stale `lastKnownEnemy` after N of the creature's own turns. Rather than the originally-envisioned goal-owned decay model (each key with an owning goal and decay rules), it uses the **flat shared memory** plus a **per-entity turn clock** — `turnTaker.actCount`. The perception-memory hook (in `planning-context.js`) stamps `turn` when it records a lead; `investigate` compares it against the current `actCount`. The richer per-key decay-with-confidence model stays deferred until a second consumer needs independent lifecycles.

---

## Goal Priority and Evaluation

Each active entity carries an **ordered goal stack** on its `ai` component (stored as
string keys resolved through the goal registry, so the component serializes cleanly).
List order *is* priority: there are no separate numeric priority fields.

Goals are evaluated top-down each turn. Each goal's `evaluate(context)` either returns
`{ action }` to act, or `null` to fall through to the next goal. The first goal to
return an action wins, and evaluation stops there. A goal that cannot or chooses not to
act returns `null` (or, when it is the always-on fallback, produces a no-op action such
as `wait`). Goals may also mutate shared memory as a side effect during evaluation even
when they fall through — for example, clearing a target key whose cancel condition fired.

Because evaluation runs fresh each turn, "interruption" is emergent rather than a
distinct mechanism: a higher goal simply returns an action this turn that it didn't last
turn. When it goes quiet again, evaluation falls back to the lower goal that was waiting
intact — an interrupted investigation resumes naturally because its memory was never
cleared.

### Example Goal Stack

```javascript
// player
ai: ['player-auto-move', 'player-auto-pickup', 'player-get-input']

// fodder NPC
ai: ['wander-aimlessly']
```

Reading a creature's goal stack top to bottom tells you its behavior priority — legible
to the designer as well as the player.

### Deferred: explicit priorities and invalidation

The richer model — explicit numeric priorities, a current goal that is only interrupted
by a strictly higher-priority goal, and per-goal invalidation conditions — is **not yet
implemented**. The current order-based, re-evaluate-every-turn approach is sufficient for
the goals built so far. Numeric priorities, sticky active goals, and decay-driven invalidation
may be revisited when NPC goals with independent lifecycles (e.g. `investigate`) require
them; see ADR-019 for the related memory-model decision.

---

## Squad Coordination and Barks

Squad coordination is handled through the sense system rather than a parallel special-case channel. When an NPC shouts for help, calls for retreat, or a commander issues an order, this spawns a **sound entity** in the world — a bark — that propagates as a hearing event. Other NPCs with hearing in range receive it and can respond by triggering appropriate goals.

*(Landed)* The first bark loop ships: an orc commander's `shout-enemy-report` goal emits an orcish enemy report (the `shout` action stamps it with the commander's `voice` language); regular orcs `obey-shouts`, advancing on the understood direction until vision hands off to chase/attack. A creature that doesn't share the language hears the noise but not the meaning — the player, knowing no orcish, just logs "guttural orcish shouting" — so silence/deafen/translate all fall out of the language model with no special-casing.

This means:
- A deafened soldier doesn't hear the retreat order
- A silenced commander can't coordinate the squad
- A player with appropriate abilities could intercept or spoof commands
- No special squad-communication system needed — it's just the hearing system

For tighter coordination (flanking assignments, target priority), a `squadState` object can be shared among a group and written to when a creature perceives relevant information. This is a higher-bandwidth channel than barks, appropriate for well-organized enemies.

```javascript
squadState: {
  playerLastKnownPos: { x, y },
  playerLastKnownTurn: 42,
  memberInDanger: entityId | null,
  flankingAssigned: boolean,
}
```

Individual goals within the squad can diverge (one flanks, one suppresses) by reading from shared state and selecting different goal configurations — no bespoke coordination logic needed.

---

## Tile Data and the Sense Abstraction

The design principle is that planners never read the world directly — only what senses report. This fully applies to entity perception (position, type, status). For tile data it is currently a known deviation: pathfinding receives the full level directly via `context.level` rather than a filtered "known map" from the sense system.

When real vision is implemented, tile visibility should be incorporated into sense results (a `visibleTiles` set or similar), and pathfinding should operate on tiles the entity has actually perceived. The player map display (fog of war) will derive from the same data. This deviation is tracked in ADR-021.

---

## What to Avoid
- Storing perception directly as memory — only retain what drove a decision
- Putting decay on the creature — decay belongs on the owning goal (when goal-owned memory is used)