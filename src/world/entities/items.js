import { components } from './components.js';
import { Slots } from '../../../data/equipment-slots.js';
import { EffectTypes } from '../../effects/core/effects.js';
import { RenderLayers } from '../../render/render-layers.js';
import { COMPASS_DIRECTIONS } from '../map/geometry.js';

// Builds a projectile's directional attack-sprite map, keyed by the compass names cardinalDirection
// returns → catalog name `${prefix}-<dir lowercase>`. The flight animation picks the entry nearest its
// bearing; weapons/ammo without one fall back to the melee wiggle. See docs/design/ranged-weapons.md.
const directionalAttackSprites = (prefix) =>
  Object.fromEntries(COMPASS_DIRECTIONS.map((d) => [d, `${prefix}-${d.toLowerCase()}`]));

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

/** Creates a Healing Potion (consumable: heal 10; thrown: heal 5 — a lesser splash — always shatters). */
export function createHealingPotion(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Healing Potion'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('healingPotion'));
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
  registry.addComponent(
    entity,
    'throwable',
    components.throwable(EffectTypes.HEAL, { amount: 5 }, 1),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates a Potion of Pain (consumable: damage 5 — a hostile drink; thrown: damage 5, always shatters). */
export function createPotionOfPain(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Potion of Pain'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('potionOfPain'));
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
  registry.addComponent(
    entity,
    'throwable',
    components.throwable(EffectTypes.DAMAGE, { amount: 5 }, 1),
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
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('dagger'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('dagger', '#101010', '/', '#cccccc', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(entity, 'weapon', components.weapon(1)); // melee, range 1
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack: 1 }));
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
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('sword'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('sword', '#101010', ')', '#dde3ff', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(entity, 'weapon', components.weapon(1)); // melee, range 1
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack: 3 }));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Creates a Spear — a reach weapon: range 2 (melee at adjacent, a thrust at distance 2), no ammunition,
 * +2 attack damage. Nothing leaves the hand. See docs/design/ranged-weapons.md.
 */
export function createSpear(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Spear'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('spear'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('spear', '#101010', '/', '#b5c7d8', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(entity, 'weapon', components.weapon(2, { meleeRange: 1 }));
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack: 2 }));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Creates a stack of Javelins — a self-thrown weapon: melee at range 1 (no consume), thrown out to
 * range 15 beyond that (consuming one of itself), +2 attack damage. Stacks small (max 5). Spawns as 3.
 */
export function createJavelin(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Javelin'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('javelin'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('javelin', '#101010', '|', '#c8b78a', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(
    entity,
    'weapon',
    components.weapon(15, {
      meleeRange: 1,
      ammoType: 'self',
      breakChance: 0.25,
      attackSprites: directionalAttackSprites('javelin'),
    }),
  );
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack: 2 }));
  registry.addComponent(entity, 'stackable', components.stackable(5, 3));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Creates a Bow — a ranged weapon firing arrows from the ammunition slot out to range 15. meleeRange 0,
 * so it always fires (no point-blank stab); the bow itself never flies. +2 attack damage.
 */
export function createBow(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Bow'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('bow'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('bow', '#101010', '}', '#c8a36a', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
  registry.addComponent(
    entity,
    'weapon',
    components.weapon(15, { meleeRange: 0, ammoType: 'arrow' }),
  );
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack: 2 }));
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/**
 * Creates a stack of Arrows — ammunition for the bow (ammoType 'arrow'), often breaking on impact
 * (breakChance 0.5). Stacks large (max 100). Spawns as 20. No passive stat bonus.
 */
export function createArrow(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Arrow'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('arrow'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('arrow', '#101010', '↑', '#d8d2b8', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.AMMUNITION));
  registry.addComponent(
    entity,
    'ammunition',
    components.ammunition('arrow', 0.5, directionalAttackSprites('arrow')),
  );
  registry.addComponent(entity, 'stackable', components.stackable(100, 20));
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
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('leatherArmor'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('leather-armor', '#101010', '[', '#c8a36a', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(entity, 'equippable', components.equippable(Slots.ARMOR));
  registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ hp: 5 }));
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
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('amulet'));
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
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('scroll'));
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

/** Creates Grapes (consumable food: satiate 10 — a light snack). */
export function createGrapes(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Grapes'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('grapes'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('grapes', '#101010', '%', '#a25fd0', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.SATIATE, { amount: 10 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates Bread (consumable food: satiate 30 — a solid meal). */
export function createBread(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Bread'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('bread'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('bread', '#101010', '%', '#c89b5a', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.SATIATE, { amount: 30 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

/** Creates Meat (consumable food: satiate 50 — a hearty feast). */
export function createMeat(registry, x, y, entityId) {
  const location = resolveItemLocation(registry, x, y, entityId);
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Meat'));
  registry.addComponent(entity, 'entityTypeId', components.entityTypeId('meat'));
  registry.addComponent(
    entity,
    'renderable',
    components.renderable('meat', '#101010', '%', '#c0523b', RenderLayers.ITEM),
  );
  registry.addComponent(entity, 'item', components.item(location));
  registry.addComponent(
    entity,
    'consumable',
    components.consumable(EffectTypes.SATIATE, { amount: 50 }),
  );
  if (location.type === 'map') {
    registry.addComponent(entity, 'position', components.position(x, y));
  }
  return entity;
}

// When you add an item factory above, register it in src/world/entities/entity-prefabs.js — that catalog is
// the single source of truth for spawnable types, and entity-prefabs.test.js fails if you forget.
