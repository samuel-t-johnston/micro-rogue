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
 * Creates a Stairs furniture (a level transition). The `port` is the direction ('up'/'down'), which
 * the dungeon transit map uses to resolve the destination and arrival point. `to` is an optional
 * pre-resolved destination, left null in the minimal cut.
 */
export function createStairs(registry, x, y, direction = 'up', to = null) {
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
  registry.addComponent(entity, 'transition', components.transition(to, direction));
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

/** Creates a Door: openable, opaque, blocking furniture (remembered in fog of war). */
export function createDoor(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Door'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('door'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'opaque', components.opaque());
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('door-closed', '#8B6F47', '+', '#c8a36a'),
  );
  registry.addComponent(entity, 'openable', components.openable('door-closed', 'door-open'));
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

// When you add a furniture factory above, register it in src/world/entities/entity-prefabs.js — that catalog
// is the single source of truth for spawnable types, and entity-prefabs.test.js fails if you forget.
