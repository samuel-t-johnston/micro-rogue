# Interactable Entities

*How tile interaction works and how to add a new interactable entity type.*

## How it works

Interaction is split across two layers:

**Detection** — `src/actions/core/resolve-tile-actions.js`
`resolveTileActions` inspects a tile and returns the actions it offers, primary first. It's the single
source of truth, shared by two callers: [`player-get-input.js`](../../src/ai/goals/player-get-input.js)
takes element `[0]` to interpret a plain tap, and the contextual tile menu
([`context-menu.js`](../../src/ui/menus/context-menu.js), raised by long-press / right-click) lists them all.
A recognised interactable component yields an `interact` action; otherwise the tile yields a `move`
(silently blocked if it isn't passable).

**Dispatch** — `src/actions/action-types/action-interact.js`
`executeInteract` receives the `interact` action, looks up the target entity, and branches on its components to invoke the right behaviour (door toggle, container dialog, etc.).

These two files are the only places that need to know about the full set of interactable types.

## Adding a new interactable type

### 1. Define a tag component

Add a factory to [`src/world/entities/components.js`](../../src/world/entities/components.js), in alphabetical order:

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

In [`src/actions/core/resolve-tile-actions.js`](../../src/actions/core/resolve-tile-actions.js), find the entity
in the adjacent branch and push an `interact` row for it (follow the `container` case):

```js
const lockable = occupants.find(e => e.components.has('lockable'));
// …
if (lockable) actions.push(interactRow('unlock', 'Unlock', lockable));
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

- **Detection is policy; dispatch is behaviour.** `resolve-tile-actions.js` decides *which* actions a tile offers (and their order); `action-interact.js` decides *what an interaction does*. Keep them separate — neither the goal nor the menu should contain interaction logic.
- **An open door defaults to moving through it.** In the resolver an open (passable) door offers `Move here` first and `Close` second, so a plain tap walks through rather than re-closing it; a closed door still defaults to `Open`. This is why the resolver checks `openable.isOpen`, not just the component's presence.
- **Branch order in `executeInteract` matters.** An entity could theoretically have more than one interactable component. The first matching branch wins, so put more specific checks first.
- **Interact actions are async.** Handlers can `await` a dialog (like `executeContainerInteract` does) and the turn loop stays suspended until the promise resolves. A cancelled dialog should return `true` (free action); a completed interaction should return `false` (turn consumed).
