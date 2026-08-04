import { components } from './components.js';

/** Creates a Boulder: an opaque, immovable obstacle (remembered in fog of war). */
export function createBoulder(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Boulder'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('boulder'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'opaque', components.opaque());
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('boulder', '#888888', 'O', '#d8d8d8'),
  );
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

/** Creates a Chest: an openable container holding items (remembered in fog of war). */
export function createChest(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Chest'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('chest'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('chest', '#8B6914', '=', '#d4af37'),
  );
  registry.addComponent(entity, 'container', components.container());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

/**
 * Creates a Stairs furniture (a level transition). `direction` ('up'/'down') sets the sprite and name;
 * `port` (defaulting to the direction) is what the dungeon transit map keys destinations and arrival
 * points off. Passing a `port` distinct from the direction lets a floor carry several same-direction
 * stairs that lead to different places (e.g. a down-stair into a branch), the generated counterpart of
 * a static layout's per-stair `port`. `to` is an optional pre-resolved destination, left null in the
 * minimal cut (the transit map resolves by port).
 */
export function createStairs(registry, x, y, direction = 'up', to = null, port = direction) {
  const up = direction === 'up';
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name(up ? 'Stairs Up' : 'Stairs Down'));
  registry.addComponent(
    entity,
    'entityTypeId',
    components.entityTypeId(up ? 'stairsUp' : 'stairsDown'),
  );
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable(up ? 'stairs-up' : 'stairs-down', '#888888', up ? '<' : '>', '#dddddd'),
  );
  registry.addComponent(entity, 'transition', components.transition(to, port));
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

/**
 * Creates the dungeon exit: the surface up-stairs, where the player wins by standing with the Amulet
 * (see win-conditions.js). Rendered like normal up-stairs and carrying an 'up' transition (so tapping
 * it is the same harmless no-op remount as any top-of-dungeon stair); the dungeonExit marker is the
 * only thing that distinguishes it. Placed explicitly by whoever authors the top level.
 */
export function createDungeonExit(registry, x, y) {
  const entity = createStairs(registry, x, y, 'up');
  // Overwrites the 'stairsUp' id createStairs stamped: the dungeon exit is its own prefab id.
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('dungeonExit'));
  registry.addComponent(entity, 'dungeonExit', components.dungeonExit());
  return entity;
}

// Stamps the components that make an entity a door onto an entity that already has a position.
// Shared by createDoor (a door from the start) and revealSecret (a dormant secret door activating
// into one), so the two can't drift. Does NOT set entityTypeId — the caller owns the entity's content
// identity (a plain door is 'door'; a revealed secret door keeps 'secretDoor').
function addDoorComponents(registry, entity, { open }) {
  registry.addComponent(entity, 'name', components.name('Door'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('door-closed', '#8B6F47', '+', '#c8a36a'),
  );
  const openable = components.openable('door-closed', 'door-open');
  registry.addComponent(entity, 'openable', openable);
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  // Closed doors block movement and sight; an open door drops both and shows the open sprite.
  if (open) {
    openable.isOpen = true;
    entity.components.get('renderable').sprite = openable.openSprite;
  } else {
    registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
    registry.addComponent(entity, 'opaque', components.opaque());
  }
}

/**
 * Creates a Door: openable, opaque, blocking furniture (remembered in fog of war). Pass
 * `{ open: true }` to spawn it already open — passable and transparent, showing the open sprite —
 * matching the runtime open state (see action-interact.js).
 */
export function createDoor(registry, x, y, { open = false } = {}) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('door'));
  registry.addComponent(entity, 'position', components.position(x, y));
  addDoorComponents(registry, entity, { open });
  return entity;
}

/**
 * Creates a dormant secret door: an entity that is indistinguishable from the wall terrain beneath it
 * until revealed (see docs/design/secret-doors-and-search.md). It deliberately carries only position,
 * its content id, and the `secret` marker — no name/renderable/openable/blocking/opacity — so every
 * reader treats the tile as the wall it sits on. `revealFloor` is the tile id written under it on
 * reveal. Callers must place it on a wall tile with floor (and something worth finding) beyond.
 */
export function createSecretDoor(registry, x, y, { revealFloor = 'floor' } = {}) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('secretDoor'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'secret', components.secret(revealFloor));
  return entity;
}

/**
 * Reveals a secret: swaps the wall terrain beneath it to its `revealFloor`, drops the `secret` marker,
 * and activates the entity into a (closed) door. Global and permanent — the terrain swap is shared
 * state, so everyone sees the door from now on. Idempotent: returns `false` (no-op) if the entity has
 * already been revealed or was never a secret. Today every secret is a door; when other secret types
 * appear, parameterize what it becomes (e.g. off the marker) rather than special-casing here.
 * @returns {boolean} `true` if this call performed the reveal, `false` if there was nothing to reveal.
 */
export function revealSecret(entity, level, registry) {
  const secret = entity.components.get('secret');
  if (!secret) return false;
  const pos = entity.components.get('position');
  level.tiles[pos.y][pos.x] = secret.revealFloor;
  registry.removeComponent(entity, 'secret');
  addDoorComponents(registry, entity, { open: false });
  return true;
}

// When you add a furniture factory above, register it in src/world/entities/entity-prefabs.js — that catalog
// is the single source of truth for spawnable types, and entity-prefabs.test.js fails if you forget.
