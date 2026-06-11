# Turn Order

*How the turn loop works and what it takes to replace it. For full semantics (speed math, free actions, rescan timing), see the design doc: [turn-order.md](../design/turn-order.md).*

## How it works

Turn order uses an **energy-accumulator model**, implemented in [`src/engine/turn-manager.js`](../../src/engine/turn-manager.js).

Every entity with a `turnTaker` component is in the queue. Each pass through the queue adds the entity's `speed` to its `accumulator`; when the accumulator reaches `1`, the entity acts and `1` is subtracted (it may act more than once if speed ≥ 1). This handles slow, normal, and fast entities with no special cases.

Acting calls the injected `invokeAction(entity)`, which returns the **free-action boolean** ([action.md](action.md)): `true` means the action was free, so the consumed tick is restored and the entity acts again immediately. The player turn counter increments only on real (consumed) player actions.

After each entity finishes, a **rescan** reconciles the queue against the entity layer — newly created entities are appended, removed/dead ones drop out. The turn manager never keeps its own authoritative entity list; it queries out via `getActiveEntities()` and trusts the entity layer.

## Replace the turn system

The module is deliberately swappable: its dependencies are **injected**, and nothing outside it knows how turns work. To swap in a different model (strict round-robin, DCSS-style time units, …), provide an alternative `createTurnManager` that honours the same interface:

**Inputs (constructor):**
- `getActiveEntities()` — all entities that belong in the queue (the entity layer owns this list).
- `invokeAction(entity)` — runs the entity's turn; returns the free-action boolean.

**Outputs (readable state):**
- `playerTurnCount` — player-facing turn counter (drives the HUD and autosave trigger).
- `currentEntity` — whose turn it is (used by UI / debug overlay).

Nothing else is exposed — queue contents, accumulators, and rescan logic are internal. The manager is wired up in [`game-scene.js`](../../src/ui/game-scene.js) (`getActiveEntities: () => registry.getEntitiesWith('turnTaker')`); a replacement just needs to satisfy the interface there.

## Worth knowing

- **The entity layer is the source of truth.** Don't have the turn module maintain a shadow entity list or subscribe to creation/death events — it queries out on each rescan, which keeps the queue and entity layer from diverging.
- **Guard free-action loops at the action level, not here.** A handler that always returns `true` spins the loop forever; the turn manager intentionally doesn't second-guess it (see [action.md](action.md)).
- **Don't rescan mid-action-resolution.** The rescan fires once per loop iteration, after the entity fully finishes, so chain reactions (a death triggering another death) resolve before the queue is reconciled.
- **The player turn counter is special.** It counts real player actions only — not free actions, not extra actions from a speed-burst.
