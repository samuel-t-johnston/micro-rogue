# Actions

*How actions are produced, dispatched, and executed — and what to consider when adding or changing one.*

## How it works

An action is a plain data object: `{ type, ...params }`, e.g. `{ type: 'move', x: 3, y: 2 }` or `{ type: 'attack', targetEntityId: 7 }`. Actions flow through three stages:

**Produced by a goal** — a goal's `evaluate(context)` returns `{ action }` (see [ai-goals.md](ai-goals.md)). This is the *only* source of actions; the player and NPCs both go through goals.

**Dispatched** — [`src/actions/action-system.js`](../../src/actions/action-system.js)
`invokeAction(entity)` evaluates the entity's goal stack, then looks the winning action's `type` up in the `dispatch` table and calls the matching handler.

**Executed** — `src/actions/action-types/action-*.js`
Each handler (`executeMove`, `executeAttack`, …) applies the effect to the world and returns a boolean.

### The return contract

Every handler returns a boolean that the turn loop depends on:

- `false` — **the action consumed the entity's turn** (the normal case).
- `true` — **free action**: the turn was not consumed and the entity is re-evaluated immediately in the same loop iteration.

This is the same contract the turn manager documents (see [turn-order.md](turn-order.md)).

## Add a new action

### 1. Write the handler

Create `src/actions/action-types/action-<name>.js` exporting `execute<Name>(actor, action, level, registry, dialogController)`. Take only the parameters you need — handlers are called with a consistent argument list but most ignore `dialogController`. Return `false` if it consumes the turn.

### 2. Register it in the dispatch table

In [`src/actions/action-system.js`](../../src/actions/action-system.js), add an entry mapping the `type` string to your handler:

```js
const dispatch = {
  // ...
  cast: (entity, action) => executeCast(entity, action, level, registry),
};
```

### 3. Produce it from a goal

Have some goal's `evaluate` return `{ action: { type: 'cast', ... } }`. An action no goal ever returns is dead code.

## Worth knowing

- **Guard against free-action loops.** A handler that always returns `true` will spin the turn loop forever. When a goal can't really act (e.g. a boxed-in wanderer), prefer returning a *consumed* `wait` action over a free action — see the note in [`wander-aimlessly.js`](../../src/ai/goals/wander-aimlessly.js).
- **Handlers can be async.** `executeInteract` `await`s a dialog and the turn loop stays suspended until it resolves. A cancelled dialog returns `true` (free); a completed one returns `false` (consumed).
- **Logging is the handler's job.** Player-facing actions call `gameLog.add({ ..., display: '...' })`; debug-only actions (move, door toggle) omit `display`. Log *before* destroying an entity so its `name` is still intact (see `executeConsume`).
- **Goal bookkeeping is not the handler's job.** Recording which goal drove the turn (`ai.lastGoal`, the `goalChange` log) happens in `invokeAction`, not in handlers — don't duplicate it.
- **A safe free action looks like `lookAt`.** [`executeLookAt`](../../src/actions/action-types/action-look.js) returns `true` (no turn spent) but doesn't loop the player forever: it's reachable only by an explicit menu submission, so the next loop iteration blocks on player input again. Free actions are safe when *something* still gates the next iteration — input, or a state change that stops them re-triggering.
