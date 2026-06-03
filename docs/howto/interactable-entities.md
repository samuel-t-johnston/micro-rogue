# Interactable Entities

*How adjacent-tap interaction works and how to add a new interactable entity type.*

## How it works

Interaction is split across two layers:

**Detection** — `src/ai/goals/player-get-input.js`
When the player taps an adjacent tile, this goal inspects the entities on that tile to decide what action to issue. If it finds a recognised interactable component it returns an `interact` action; otherwise it returns a `move` action (which may be blocked silently if the tile isn't passable).

**Dispatch** — `src/actions/action-types/action-interact.js`
`executeInteract` receives the `interact` action, looks up the target entity, and branches on its components to invoke the right behaviour (door toggle, container dialog, etc.).

These two files are the only places that need to know about the full set of interactable types.

## Adding a new interactable type

### 1. Define a tag component

Add a factory to [`src/world/components.js`](../../src/world/components.js), in alphabetical order:

```js
lockable() {
  return {};
},
```

### 2. Add it to the entity factory

Apply the component when building the entity, alongside any others it needs:

```js
registry.addComponent(entity, 'lockable', components.lockable());
```

### 3. Register it for detection

In [`src/ai/goals/player-get-input.js`](../../src/ai/goals/player-get-input.js), add the component name to the `find` check in the adjacent-tap branch:

```js
const interactable = [...level.getEntitiesAt(input.x, input.y)]
  .find(e => e.components.has('openable')
           || e.components.has('container')
           || e.components.has('lockable'));  // add here
```

### 4. Add a dispatch branch

In [`src/actions/action-types/action-interact.js`](../../src/actions/action-types/action-interact.js), add a branch before the fallthrough `return false`:

```js
if (target.components.has('lockable')) {
  return executeLockableInteract(actor, target, registry);
}
```

Then implement the handler as a module-private function in the same file, following the `executeDoorInteract` / `executeContainerInteract` pattern.

## Worth knowing

- **Detection is policy; dispatch is behaviour.** `player-get-input.js` decides *whether* to interact. `action-interact.js` decides *what that interaction does*. Keep them separate — the goal should not contain game logic.
- **Branch order in `executeInteract` matters.** An entity could theoretically have more than one interactable component. The first matching branch wins, so put more specific checks first.
- **Interact actions are async.** Handlers can `await` a dialog (like `executeContainerInteract` does) and the turn loop stays suspended until the promise resolves. A cancelled dialog should return `true` (free action); a completed interaction should return `false` (turn consumed).
- **Non-blocking interactables** (entities without `blocksMovement`) will still trigger an interact action if the player taps their tile. The player won't try to move through them — the detection check runs before the move.
