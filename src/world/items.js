import { components } from './components.js';

const SPRITES = {
  potion: { col: 16, row: 16 }, // 1-indexed: col 17, row 17 
};

export function createPotion(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Potion'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.potion, '#07fe49ff'));
  registry.addComponent(entity, 'item', components.item({ type: 'map' }));
  return entity;
}
