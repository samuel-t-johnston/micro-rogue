# Turn Order System
*Reference notes for JS/HTML roguelike development*

## Core Principle: Energy-Based Accumulator Queue

Turn order uses a fractional energy accumulator model. Each entity that can act maintains an energy value. The turn loop advances through a queue, granting energy each step and acting when energy is sufficient. This handles varied speeds — including sub-1 speeds and multi-action speeds — without special cases.

---

## The Queue

The turn queue contains all entities with a `TurnTaker` component on the current level, plus the player. Entities are ordered by insertion time; newly added entities always go to the end.

The queue is not authoritative about which entities exist — the entity layer is. The queue is a processing order derived from the entity layer. On each rescan, the queue is reconciled against the entity layer: entities no longer present are removed, entities newly present are added to the end with accumulator starting at 0.

---

## The Turn Loop

```
loop:
  entity = queue.front()
  entity.accumulator += entity.speed
  if entity.accumulator >= 1:
    while entity.accumulator >= 1:
      entity.accumulator -= 1
      free = entity.act()        // returns true if action was "free"
      if free: entity.accumulator += 1  // free action: restore the consumed tick
      if entity is player: player acts, loop pauses for input
  else:
    queue.moveToBack(entity)
  rescan()                       // reconcile queue against entity layer
```

The rescan fires once per loop iteration — after the entity finishes acting (or is moved to the back). This timing means:

- An entity that kills itself is gone by the time the next entity is processed.
- Chain reactions (A kills B, B's death triggers a trap, trap kills C) fully resolve before the rescan, because the rescan fires after full action resolution, not after each sub-event.
- Newly spawned entities enter at the end of the queue, never mid-round.

---

## Speed and Accumulator Semantics

Speed is a numeric property on any entity with a `TurnTaker` component.

| Speed value | Behavior |
|---|---|
| < 1 (e.g. 0.5) | Acts less than once per round — energy accumulates across multiple queue passes before the threshold is reached |
| 1.0 | Acts exactly once per round — typical for most entities |
| 1.0–2.0 | Sometimes acts twice in a round, depending on fractional accumulation |
| ≥ 2.0 | Acts multiple times per round |

No negative speeds. Speed is a non-negative value; enforcement is at the component level.

New entities always start with accumulator 0, regardless of when in the round they are added. This is intentional — a freshly summoned entity waits its proportional turn before acting. More complex initialization (e.g. entering combat-ready) is deferred until a concrete use case requires it.

Speed changes mid-combat (haste, slow, etc.) require no special handling. The accumulator reflects stored energy; the speed value governs the next increment. Changing speed on a live entity takes effect on that entity's next queue pass.

---

## Free Actions

An entity's `act()` invocation returns a boolean indicating whether the action consumed a tick.

- `true` (consumed): normal path. The accumulator was decremented and the entity used its action.
- `false` (free): the action did not consume the tick. The accumulator increment is restored; the entity acts again immediately in the same loop iteration.

Free actions do not advance the entity's position in the queue. They do not trigger a rescan. They do not increment the player turn counter.

Use free actions sparingly. Infinite free action loops are possible if `act()` consistently returns false — guard against this at the action level, not in the turn loop.

---

## Player Turn Counter

The player turn counter increments once per real action the player takes — not per free action, not per extra action from a speed > 1 burst. This counter is the player-facing turn tracker displayed in the HUD, and is the natural trigger for the autosave (see save-system.md).

The counter is owned by the turn module and exposed as readable state. NPCs have no equivalent counter.

---

## Module Interface

The turn module is self-contained. Its external interface:

**Inputs (dependencies injected at construction):**
- `getActiveEntities()` — returns all entities that should be in the queue. Called on each rescan. The entity layer owns this list; the turn module does not.
- `invokeAction(entity)` — calls into the AI/action system. Returns boolean (free action or not). The turn module does not know what actions are.

**Outputs (readable state):**
- `playerTurnCount` — current player turn counter.
- `currentEntity` — the entity whose turn it is (useful for UI and debug overlay).

**Nothing else is exposed.** Queue contents, accumulator values, and rescan logic are internal.

This boundary means the entire turn module can be swapped — for a time-unit system (DCSS-style), a strict round-robin, or any other model — by providing an alternative implementation that satisfies the same interface. Downstream developers should not need to touch the action system or entity layer to replace it.

---

## The Rescan

The rescan is a lightweight reconciliation, not a full rebuild:

1. Remove any entity from the queue that is not in `getActiveEntities()`.
2. Add any entity in `getActiveEntities()` not already in the queue — append to the end, accumulator 0.

The turn module does not subscribe to entity creation/death events. It does not maintain a shadow list. It queries out on each rescan and trusts the entity layer as the source of truth. This prevents the queue and the entity layer from diverging.

---

## What to Avoid

- Maintaining the turn module's own authoritative entity list — always query out; the entity layer is the source of truth
- Triggering the rescan mid-action-resolution — scan after full resolution only
- Negative speed values — non-negative is enforced at the component level
- Incrementing the player turn counter on free actions or speed burst extra actions
- Saving mid-turn-resolution — the autosave fires on player turn start, after state is fully settled (see save-system.md)