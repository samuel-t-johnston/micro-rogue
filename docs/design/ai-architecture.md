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

**Vision** — FOV algorithm (e.g. shadowcasting) gated by per-tile light level. Full detail on observed entities: exact position, appearance, visible equipment.

**Darkvision** — Same FOV algorithm, skips light check. Silhouette-level detail rather than full.

**Hearing** — Event-based rather than a sweep query. Sounds are emitted into the world with position, volume, and type, then propagate (attenuated by walls and distance). Entities with hearing receive events in range. Gives approximate position and a type hint only — not exact coordinates.

**Smell** — Persistent field model. Entities leave scent trails stored as a sparse map (`{x,y} → {sourceId, intensity, turn}`) that decay over turns. Smell-sensitive creatures can follow trails.

### Information Quality

Different senses yield different quality of information:

| Sense | Position | Entity type | Detail | Notes |
|---|---|---|---|---|
| Vision | Exact | Full | High | Blocked by opaque tiles and darkness |
| Darkvision | Exact | Silhouette | Medium | Blocked by opaque tiles, ignores light |
| Hearing | Approximate | Type hint | Low | Passes around corners, muffled by walls |
| Smell | Trail only | ID if known | Low | Follows decay curve over turns |

An approximate position is represented as a radius of uncertainty rather than a point. The AI can still act on low-quality information — a creature that hears something can pursue a `investigate` goal toward an uncertain position without knowing exactly where the player is.

### Merging Into World State

Sense results are merged into world-state facts each turn before planning. Where senses conflict, higher-quality data wins. Reported entity positions carry confidence metadata:

```javascript
{ position, confidence, turnObserved }
```

This lets the AI reason about stale data — a position seen 10 turns ago is less reliable than one seen this turn.

---

## Memory

Memory is separate from sense results. Rather than caching all perception, only data that **drove a decision** is retained. If a sense result triggered a plan, it is stored as the context justifying that plan. Background perception that didn't affect behavior evaporates.

### Memory Decay on the Goal

Decay is a property of the **goal**, not the creature. This keeps decay encapsulated and allows goals to have independent stickiness:

```javascript
{
  id: 'investigate',
  priority: 50,
  condition: 'alertCauseExists',
  memory: {
    alertCause: { pos, turn, source },
  },
  decayRate: 3,       // confidence drops per turn
  minConfidence: 20,  // goal invalidates below this
}
```

A `vendetta` goal — a creature that was attacked and holds a grudge — might have near-zero decay. A `curious` goal triggered by a faint distant sound decays in a few turns. These feel like creature personality but live entirely in goal configuration.

---

## Goal Priority and Invalidation

Goals have explicit numeric priorities. The active goal is only interrupted by a **higher-priority** goal becoming valid — equal or lower priority goals do not interrupt.

Goals are evaluated top-down each turn. Replan fires when:

- A higher-priority goal's condition becomes true → interrupt
- The current goal's own conditions are no longer amenable (target lost, path blocked, etc.) → invalidate and fall through to next valid goal

When a higher-priority goal resolves, the creature falls back to the lower-priority goal that was waiting intact. An interrupted investigation resumes naturally after a threat is lost, because the investigate goal and its memory were never cleared.

### Example Goal Stack

```javascript
goals: [
  { id: 'flee',         priority: 100, condition: 'hp < 20%' },
  { id: 'attackThreat', priority: 80,  condition: 'threatVisible' },
  { id: 'investigate',  priority: 50,  condition: 'alertCauseExists',
    memory: { alertCause: { pos, turn, source } },
    decayRate: 3, minConfidence: 20 },
  { id: 'patrol',       priority: 20,  condition: 'always' },
]
```

Reading a creature's goal list top to bottom tells you exactly what it takes to interrupt it — legible to the designer as well as the player.

---

## Squad Coordination and Barks

Squad coordination is handled through the sense system rather than a parallel special-case channel. When an NPC shouts for help, calls for retreat, or a commander issues an order, this spawns a **sound entity** in the world — a bark — that propagates as a hearing event. Other NPCs with hearing in range receive it and can respond by triggering appropriate goals.

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

## Architectural Door: Multi-Turn Actions

Not pursued immediately, but the hook to leave open is a `turnsRequired` field on actions:

```javascript
{ action: 'castRitual', turnsRequired: null }
// null = resolves in one turn; >1 = held across turns
```

When `turnsRequired > 1`, the execution loop holds the action across turns and raises the priority threshold required to interrupt it. Nothing else in the architecture needs to change when this is revisited.

---

## What to Avoid

- Re-evaluating goals from scratch every turn — check invalidation conditions instead
- Storing perception directly as memory — only retain what drove a decision
- Treating squad communication as a special system — route it through hearing
- Putting decay on the creature rather than the goal — goals should own their memory lifecycle