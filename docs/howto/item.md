# Items

*How items work and how to add a new one. For the two specializations, see [equipment.md](equipment.md) and [consumable.md](consumable.md).*

## How it works

An item is an **entity** ([component.md](component.md)) built from:

- `name` and `renderable` — like any visible entity (items use `RenderLayers.ITEM` so a creature standing on a dropped item draws on top);
- the **`item`** component, which carries the item's **location**;
- a **type-specific** component that says what the item *does* — `equippable` ([equipment.md](equipment.md)) or `consumable` ([consumable.md](consumable.md)).

The factories live in [`src/world/entities/items.js`](../../src/world/entities/items.js) (`createHealingPotion`, `createDagger`, …).

### Location vs. position

The `item` component's `location` says where the item lives:

```
{ type: 'map' } | { type: 'inventory', ownerId } | { type: 'equipped', ownerId, slot } | { type: 'container', containerId }
```

`resolveItemLocation(registry, x, y, entityId)` derives this for you: pass `x, y` for a map item, or an `entityId` (a container or an inventory holder) for a contained one. **Only map items also carry a `position` component** — for the others, the owner's position is where they are.

Moving items between locations is done by **actions**, not by editing the component directly: pickup, drop, equip/unequip, container take ([action.md](action.md)).

## Add a new item

Add a `createX(registry, x, y, entityId)` factory to [`src/world/entities/items.js`](../../src/world/entities/items.js):

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

Then decide its behaviour by adding `equippable` ([equipment.md](equipment.md)) and/or `consumable` ([consumable.md](consumable.md)), and optionally `throwable` (see below).

Finally, register it in the prefab catalog [`src/world/entities/entity-prefabs.js`](../../src/world/entities/entity-prefabs.js) keyed by a stable id, e.g. `torch: { kind: 'item', make: createTorch }`. Maps and `stage-populate` place items by this id, and [`entity-prefabs.test.js`](../../src/world/entities/entity-prefabs.test.js) fails if a `create*` factory is left unregistered.

## Throwing

**Any** carried item can be thrown (the inventory's per-item menu always offers *Throw*, which opens the targeting cursor — aim at any visible tile, then tap to throw or Cancel to back out). The optional **`throwable`** component gives it an on-hit *effect* and a chance to shatter:

```js
// effectType + params mirror `consumable`; breakChance (0..1) is the odds it shatters on impact.
registry.addComponent(entity, 'throwable', components.throwable(EffectTypes.DAMAGE, { amount: 5 }, 1));
```

`executeThrow` ([action-throw.js](../../src/actions/action-types/action-throw.js)) traces the item's flight as a **straight line** (Bresenham, `lineTiles` in [geometry.js](../../src/world/map/geometry.js)) from the thrower toward the aimed tile. Because that's a physical line — not the symmetric-shadowcast FOV used for *aiming* — it stops at the first tile that blocks it (a wall, a fixture, or a creature), which may be short of the aimed tile. On the **impact** tile it applies the effect to each non-item entity that can receive it (e.g. damage/heal need `health`), then either destroys the item (it broke) or comes to rest:

- on the impact tile if that tile can **hold** an item, or
- bouncing back to the last clear tile otherwise — so a thrown item never strands somewhere it can't be retrieved.

A tile holds an item unless it's solidly filled: this is `blocksMovement` **minus the `creature` exception**, derived rather than tracked as its own component. Walls and solid fixtures (boulders, chests, closed doors) reject a resting item; an item lands at a **creature's** feet (recoverable when it moves or dies) and on an **open door** (which drops its `blocksMovement` when opened). If a future entity ever needs to diverge from "blocks movement but isn't a creature," that's the moment to add an explicit `blocksItemDrop` marker.

A thrown effect is independent data from the drinking effect, so the same potion can heal 10 when drunk but only 5 when splashed.

## Worth knowing

- **`x,y` and `entityId` are mutually exclusive.** `resolveItemLocation` throws if you pass half a position, or neither a position nor an `entityId`. A map item gets a `position`; a contained item does not.
- **Throwing is opt-out for the effect, not the act.** Every item can be thrown; only a `throwable` one does anything on impact (and only it can break). Scrolls, armor, weapons without `throwable` just land on the tile.
- **`equippable` is intentionally separate from `item`.** Keeping them apart lets non-item things (future spells, innate abilities) be equippable without being items.
- **Don't mutate `location` by hand.** Let the pickup/drop/equip/take actions move items so the level, inventory, and component stay consistent.
