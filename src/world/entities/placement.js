import { components } from './components.js';

/**
 * Drops an item entity onto the map at (x, y): marks its `location` as map, ensures a `position`
 * component at that tile (updating an existing one in place), and inserts it into the level's spatial
 * index. The item must already have left any prior location (inventory / equipment / container).
 *
 * The one definition of "an item comes to rest on the floor", shared by executeDrop and the
 * projectile-landing path so a dropped item and a thrown/fired one settle identically.
 */
export function placeItemOnMap(registry, level, item, x, y) {
  item.components.get('item').location = { type: 'map' };
  if (item.components.has('position')) {
    const p = item.components.get('position');
    p.x = x;
    p.y = y;
  } else {
    registry.addComponent(item, 'position', components.position(x, y));
  }
  level.placeEntity(item);
}

/**
 * Item-factory tail: a map item (`location.type === 'map'`) gets a `position` at (x, y); an
 * inventory / equipment / container item carries no position, so this is a no-op for it. Returns the
 * entity so a factory can `return addMapPosition(registry, entity, location, x, y)`. The caller places
 * the finished map item into the level (`level.placeEntity(createX(...))`).
 */
export function addMapPosition(registry, entity, location, x, y) {
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}
