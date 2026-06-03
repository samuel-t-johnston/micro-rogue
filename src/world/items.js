import { components } from './components.js';

const SPRITES = {
  potion: { col: 16, row: 16 }, // 1-indexed: col 17, row 17
};

// Resolves item location from (x, y) for map items or entityId for contained items.
// x and y must be provided together or not at all.
// entityId must reference an entity with either a container or inventory component.
export function resolveItemLocation(registry, x, y, entityId) {
  const hasX = x != null;
  const hasY = y != null;
  if (hasX !== hasY) throw new Error('Item position requires both x and y');

  if (hasX) return { type: 'map' };

  if (entityId == null) throw new Error('Item requires either x,y position or an entityId');

  const host = registry.getEntity(entityId);
  if (!host) throw new Error(`No entity with id ${entityId}`);
  if (host.components.has('container')) return { type: 'container', containerId: entityId };
  if (host.components.has('inventory')) return { type: 'inventory', ownerId: entityId };
  throw new Error(`Entity ${entityId} has neither container nor inventory component`);
}

export function createPotion(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Potion'));
  registry.addComponent(entity, 'renderable', components.renderable(SPRITES.potion, '#07fe49ff'));
  registry.addComponent(entity, 'item', components.item(location));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}
