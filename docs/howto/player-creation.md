# Player Character Creation
Purpose: How player character creation works and how to extend it.

## Where it lives

`src/world/entities/player.js` — single module responsible for constructing the player entity. `game-scene.js` calls it and receives an entity; it knows nothing about what components that entity has.

## Current interface

```js
const player = await createPlayer(registry, startX, startY);
level.placeEntity(player);
```

`createPlayer` is async even though it currently resolves immediately. This is intentional — see *Extending with UI* below.

## Adding or changing player components

All component changes belong in `player.js`. Add components via the registry the same way any entity is built:

```js
import { components } from './components.js';

export async function createPlayer(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(20));  // add new components here
  // ...
  return entity;
}
```

New component types go in `src/world/entities/components.js` first.

## Extending with a character creation UI

When a character selection or stat-rolling screen is needed, `createPlayer` is the right place to add it. Because the function is already async, the call site in `game-scene.js` does not change — the function just awaits user interaction before returning the entity:

```js
export async function createPlayer(registry, x, y) {
  const config = await showCharacterCreationScreen(); // resolves when player confirms
  const entity = registry.createEntity();
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(config.startingHp));
  // ...
  return entity;
}
```

The character creation screen itself would be a UI scene (following the same pattern as `game-scene.js` and `splash.js`) registered with the app state machine.

## Entity templates

Once more than one character type exists, the component setup in `createPlayer` can be driven by a data file (e.g. `data/characters/ranger.js`) rather than hardcoded inline. That refactor belongs here when the need arises — don't build it speculatively.
