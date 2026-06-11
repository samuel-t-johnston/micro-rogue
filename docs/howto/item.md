# Items

*How items work and how to add a new one. For the two specializations, see [equipment.md](equipment.md) and [consumable.md](consumable.md).*

## How it works

An item is an **entity** ([component.md](component.md)) built from:

- `name` and `renderable` — like any visible entity (items use `RenderLayers.ITEM` so a creature standing on a dropped item draws on top);
- the **`item`** component, which carries the item's **location**;
- a **type-specific** component that says what the item *does* — `equippable` ([equipment.md](equipment.md)) or `consumable` ([consumable.md](consumable.md)).

The factories live in [`src/world/items.js`](../../src/world/items.js) (`createHealingPotion`, `createDagger`, …).

### Location vs. position

The `item` component's `location` says where the item lives:

```
{ type: 'map' } | { type: 'inventory', ownerId } | { type: 'equipped', ownerId, slot } | { type: 'container', containerId }
```

`resolveItemLocation(registry, x, y, entityId)` derives this for you: pass `x, y` for a map item, or an `entityId` (a container or an inventory holder) for a contained one. **Only map items also carry a `position` component** — for the others, the owner's position is where they are.

Moving items between locations is done by **actions**, not by editing the component directly: pickup, drop, equip/unequip, container take ([action.md](action.md)).

## Add a new item

Add a `createX(registry, x, y, entityId)` factory to [`src/world/items.js`](../../src/world/items.js):

```js
export function createTorch(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Torch'));
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.torch, '#000', 'i', '#fa0', RenderLayers.ITEM));
  registry.addComponent(entity, 'item', components.item(location));
  // + a type component: equippable(...) or consumable(...)
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}
```

Then decide its behaviour by adding `equippable` ([equipment.md](equipment.md)) and/or `consumable` ([consumable.md](consumable.md)).

## Worth knowing

- **`x,y` and `entityId` are mutually exclusive.** `resolveItemLocation` throws if you pass half a position, or neither a position nor an `entityId`. A map item gets a `position`; a contained item does not.
- **`equippable` is intentionally separate from `item`.** Keeping them apart lets non-item things (future spells, innate abilities) be equippable without being items.
- **Don't mutate `location` by hand.** Let the pickup/drop/equip/take actions move items so the level, inventory, and component stay consistent.
