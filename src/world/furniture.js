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
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.boulder, '#888888'));
  return entity;
}

export function createChest(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Chest'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.chest, '#8B6914'));
  registry.addComponent(entity, 'container', components.container());
  registry.addComponent(entity, 'inventory', components.inventory());
  return entity;
}

export function createDoor(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Door'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'opaque', components.opaque());
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.doorClosed, '#8B6F47'));
  registry.addComponent(entity, 'openable', components.openable(SPRITES.doorClosed, SPRITES.doorOpen));
  return entity;
}
