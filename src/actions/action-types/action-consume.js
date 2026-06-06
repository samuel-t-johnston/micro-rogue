import { applyEffect } from '../../effects/effects.js';

// Consumes an item from the actor's inventory: applies its effect to the actor,
// then removes the item from inventory and destroys the entity.
// action.targetEntityId is optional — currently always self (drinking); a future
// "throw potion" action could pass a different target through the same handler.
// Returns false — consume always consumes a turn.
export function executeConsume(actor, action, level, registry) {
  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  const item = inventory.items.find(e => e.id === action.itemEntityId);
  if (!item) return false;

  const consumable = item.components.get('consumable');
  if (!consumable) return false;

  const target = action.targetEntityId != null ? registry.getEntity(action.targetEntityId) : null;
  applyEffect(consumable.effectType, actor, target, consumable.params, level, registry);

  const idx = inventory.items.indexOf(item);
  if (idx >= 0) inventory.items.splice(idx, 1);
  registry.destroyEntity(item);

  return false;
}
