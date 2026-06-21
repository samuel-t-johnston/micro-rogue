import { components } from './components.js';

const SPRITES = {
  boulder:    { col: 16, row: 12 }, // 1-indexed: col 17, row 13
  chest:      { col: 10, row: 23 }, // 1-indexed: col 11, row 24
  doorClosed: { col: 16, row: 22 }, // 1-indexed: col 17, row 23
  doorOpen:   { col: 17, row: 22 }, // 1-indexed: col 18, row 23
};

export function createBoulder(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Boulder'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'opaque', components.opaque());
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.boulder, '#888888', 'O', '#a8a8a8'));
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

export function createChest(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Chest'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.chest, '#8B6914', '=', '#d4af37'));
  registry.addComponent(entity, 'container', components.container());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

// Stairs are glyph-rendered for now ('<' up, '>' down). The transition's `port` is the direction
// ('up'/'down'), which the dungeon transit map uses to resolve the destination and arrival point.
// `to` is an optional pre-resolved destination, left null in the minimal cut.
export function createStairs(registry, x, y, direction = 'up', to = null) {
  const up = direction === 'up';
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name(up ? 'Stairs Up' : 'Stairs Down'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'renderable', components.renderable(null, '#888888', up ? '<' : '>', '#dddddd'));
  registry.addComponent(entity, 'transition', components.transition(to, direction));
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}

// The dungeon exit: the surface up-stairs, where the player wins by standing with the Amulet (see
// win-conditions.js). Rendered like normal up-stairs and carrying an 'up' transition (so tapping it
// is the same harmless no-op remount as any top-of-dungeon stair); the dungeonExit marker is the
// only thing that distinguishes it. Placed explicitly by whoever authors the top level.
export function createDungeonExit(registry, x, y) {
  const entity = createStairs(registry, x, y, 'up');
  registry.addComponent(entity, 'dungeonExit', components.dungeonExit());
  return entity;
}

export function createDoor(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Door'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'opaque', components.opaque());
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.doorClosed, '#8B6F47', '+', '#c8a36a'));
  registry.addComponent(entity, 'openable', components.openable(SPRITES.doorClosed, SPRITES.doorOpen));
  registry.addComponent(entity, 'persistVisible', components.persistVisible());
  return entity;
}
