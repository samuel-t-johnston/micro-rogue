# Components

*A brief intro to the entity-component-system (ECS) and how to add a new component.*

## How it works

The ECS has two parts:

**The registry** — [`src/engine/core/entity-component-system.js`](../../src/engine/core/entity-component-system.js)
Owns all entities and a reverse index for fast queries. An entity is just `{ id, components: Map }` — an id and a bag of components. The registry adds/removes/gets components and answers `getEntitiesWith(name)` in O(matches) via a `componentName → Set<id>` index that's kept in sync on every add, remove, and destroy.

**The components** — [`src/world/entities/components.js`](../../src/world/entities/components.js)
Each component is *plain data* created through a factory function. The factory file is the single definition site for every component's shape and defaults. There is no `System` class: a "system" is just a function that queries `getEntitiesWith(...)` and reads or writes component data — the turn manager, the action handlers, the senses, and the renderer are all systems in this sense.

The guiding rule: **components are data, behaviour lives in systems.** A component never holds methods or function references.

## Add a new component

### 1. Add a factory

Add to [`src/world/entities/components.js`](../../src/world/entities/components.js) in alphabetical order (the file is kept sorted):

```js
poisoned(turnsRemaining) {
  return { turnsRemaining };
},
```

### 2. Attach it through the registry

Never build the component as an inline object literal — always go through the factory and `addComponent`:

```js
registry.addComponent(entity, 'poisoned', components.poisoned(5));
```

### 3. Query it from a system

```js
for (const e of registry.getEntitiesWith('poisoned')) {
  const p = e.components.get('poisoned');
  // ...
}
```

## Worth knowing

- **Keep components serializable.** Saves persist component data directly, so store *data*, never function references. Where a component needs to point at behaviour, it holds a **string key** resolved through a registry at use time — see `ai.goals` ([ai-goals.md](ai-goals.md)), `senses` ([ai-senses.md](ai-senses.md)), and `consumable.effectType` ([consumable.md](consumable.md)). This is the single most important convention in the file.
- **The reverse index is the only query path.** `getEntitiesWith(name)` reads the index; there is no full scan. `addComponent`/`removeComponent`/`destroyEntity` all maintain it — so always mutate components through the registry, not by poking `entity.components` directly, or the index drifts.
- **Not every component is an object.** `name` is a bare string and `faction` is an array. The factory defines each shape; trust it rather than assuming `{ ... }`.
- **Entities are defined by recipes, not classes.** A creature, an item, and a door are all just different sets of components — see [creature.md](creature.md) and [item.md](item.md).
