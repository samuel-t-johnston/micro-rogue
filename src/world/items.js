import { components } from './components.js';
import { Slots } from '../../data/equipment-slots.js';
import { EffectTypes } from '../effects/effects.js';
import { RenderLayers } from '../render/render-layers.js';

/**
 * Resolves an item's `location` from (x, y) for map items or `entityId` for contained items. x and y
 * must be provided together or not at all; `entityId` must reference an entity with a container or
 * inventory component.
 * @throws {Error} On an invalid combination, an unknown entity, or a host with neither component.
 */
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

/** Creates a Healing Potion (consumable: heal 10). */
export function createHealingPotion(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Healing Potion'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('healing-potion', '#101010', '!', '#07fe49ff', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.HEAL, { amount: 10 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates a Potion of Pain (consumable: damage 5 — a hostile drink). */
export function createPotionOfPain(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Potion of Pain'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('potion-of-pain', '#101010', '!', '#e0352f', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.DAMAGE, { amount: 5 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates a Dagger (weapon: +1 attack damage). */
export function createDagger(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Dagger'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('dagger', '#101010', '/', '#cccccc', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(
    entity,
    'attributeModifiers',
    components.attributeModifiers({ attackDamage: 1 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates a Sword (weapon: +3 attack damage). */
export function createSword(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Sword'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('sword', '#101010', ')', '#dde3ff', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(
    entity,
    'attributeModifiers',
    components.attributeModifiers({ attackDamage: 3 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates Leather Armor (armor: +5 max HP). */
export function createLeatherArmor(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Leather Armor'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('leather-armor', '#101010', '[', '#c8a36a', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.ARMOR));
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ HP: 5 }));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Creates the Amulet of Yendor — the classic win objective. A plain carried item: no
 * consumable/equippable behavior, just a questItem tag the win condition keys on.
 */
export function createAmulet(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Amulet of Yendor'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('amulet-of-yendor', '#101010', '"', '#ffd700', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'questItem', components.questItem('amulet-of-yendor'));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates a Scroll of Healing (consumable: heal 15). */
export function createScroll(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Scroll of Healing'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('scroll-of-healing', '#101010', '?', '#e6e0c0', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.HEAL, { amount: 15 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Sample constructors for every item, keyed by label — one canonical instance of each placed at the
 * origin. The source of truth for "which items exist" when enumerating content (e.g. the sprite/glyph
 * coverage test). Add an item here when you add its factory above.
 */
export const ITEM_SAMPLES = {
  'healing potion': (r) => createHealingPotion(r, 0, 0),
  'potion of pain': (r) => createPotionOfPain(r, 0, 0),
  dagger: (r) => createDagger(r, 0, 0),
  sword: (r) => createSword(r, 0, 0),
  'leather armor': (r) => createLeatherArmor(r, 0, 0),
  amulet: (r) => createAmulet(r, 0, 0),
  scroll: (r) => createScroll(r, 0, 0),
};
