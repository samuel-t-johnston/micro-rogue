/**
 * @file Synthetic test fixtures — bare entity builders carrying only the components a mechanic under
 * test actually needs, with caller-supplied values. Behavior tests use these instead of the shipped
 * content factories (world/entities/{creatures,items}.js) when they need a container-with-the-right-
 * components rather than a specific creature or item: a v0.4+ roster/stat/loadout change then can't
 * break a test that isn't about that content. Tests that ARE about the shipped content (items.test.js
 * values, the save-vN.json format fixtures) stay on the real factories by design.
 *
 * Builders return the created entity; each adds the minimum components for its role. Grow this module
 * as migrations need it rather than front-loading unused builders.
 */
import { components } from '../world/entities/components.js';
import { HUMANOID_SLOTS } from '../../data/equipment-slots.js';

/**
 * A bare humanoid: an `inventory` plus a `wearsEquipment` with the standard humanoid slots — the
 * container the equip/inventory mechanics reason over, with none of a creature's stats, faction, or
 * position. Pass `name` when a test asserts on log text (otherwise log lines read "the creature").
 */
export function humanoid(registry, { name } = {}) {
  const entity = registry.createEntity();
  if (name != null) registry.addComponent(entity, 'name', components.name(name));
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  return entity;
}

// Resolves an item's `location` from the placement options — on the map (x,y), inside a container
// (containerId), else in an owner's inventory (ownerId) — matching how the shipped item factories set
// it via resolveItemLocation.
function itemLocation({ x, y, ownerId, containerId }) {
  if (x != null && y != null) return { type: 'map' };
  if (containerId != null) return { type: 'container', containerId };
  return { type: 'inventory', ownerId };
}

// Adds the common item tail (item location, optional name, position for map items) to a fresh entity.
function baseItem(registry, entity, { x, y, ownerId, containerId, name }) {
  if (name != null) registry.addComponent(entity, 'name', components.name(name));
  registry.addComponent(
    entity,
    'item',
    components.item(itemLocation({ x, y, ownerId, containerId })),
  );
  if (x != null && y != null) registry.addComponent(entity, 'position', components.position(x, y));
  return entity;
}

/**
 * A consumable item carrying a caller-supplied effect + amount, so a test asserts against the amount it
 * set rather than a shipped potion's baked-in value. Place it in an owner's inventory (`ownerId`) or on
 * the map (`x`, `y`). `effect` is an EffectTypes value ('heal' by default).
 */
export function consumable(
  registry,
  { effect = 'heal', amount = 1, x, y, ownerId, containerId, name } = {},
) {
  const entity = baseItem(registry, registry.createEntity(), { x, y, ownerId, containerId, name });
  registry.addComponent(entity, 'consumable', components.consumable(effect, { amount }));
  return entity;
}

/**
 * An equippable item for the given `slot`, optionally with an `attack` modifier (the "best weapon"
 * yardstick). Place it in an owner's inventory (`ownerId`) or on the map (`x`, `y`).
 */
export function equippable(registry, { slot, attack, x, y, ownerId, containerId, name } = {}) {
  const entity = baseItem(registry, registry.createEntity(), { x, y, ownerId, containerId, name });
  registry.addComponent(entity, 'equippable', components.equippable(slot));
  if (attack != null) {
    registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attack }));
  }
  return entity;
}

/**
 * A stackable item with the given cap and count. Two stackables built with the same options share a
 * stack signature (see inventory-stacking.js), so they merge/consolidate — what the pickup/split/stack
 * mechanics are tested against. Place it in an owner's inventory (`ownerId`) or on the map (`x`, `y`).
 */
export function stackable(registry, { maxStackSize = 100, count = 1, x, y, ownerId, name } = {}) {
  const entity = baseItem(registry, registry.createEntity(), { x, y, ownerId, name });
  registry.addComponent(entity, 'stackable', components.stackable(maxStackSize, count));
  return entity;
}
