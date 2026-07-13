import { applyEffect } from '../../effects/core/effects.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';

/**
 * Consumes one unit of an item from the actor's inventory: applies its effect to the actor, then
 * removes a single unit — decrementing the count of a stack of more than one, or removing the item
 * from inventory and destroying the entity on the last (or only) unit. `action.targetEntityId` is
 * optional — currently always self (drinking); a future "throw potion" action could pass a different
 * target through the same handler.
 * @returns {boolean} Always `false` — consuming an item consumes the turn.
 */
export function executeConsume(actor, action, level, registry) {
  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  const item = inventory.items.find((e) => e.id === action.itemEntityId);
  if (!item) return false;

  const consumable = item.components.get('consumable');
  if (!consumable) return false;

  const target = action.targetEntityId != null ? registry.getEntity(action.targetEntityId) : null;
  applyEffect(consumable.effectType, actor, target, consumable.params, level, registry);

  // Log before destroying the item, while its name component is still intact.
  gameLog.add({
    actor: actor.id,
    action: 'consume',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'consume', 'consumes')} the ${itemName(item)}.`,
  });

  // Remove one unit: decrement a stack of more than one; splice + destroy only on the last (or a
  // non-stackable) unit. Mirrors the ammo path (action-attack.consumeOneProjectile) so consuming one
  // of N no longer annihilates the whole stack. The count suffix in the name is derived dynamically
  // (quantitySuffix), so nothing else needs updating.
  const stackable = item.components.get('stackable');
  if (stackable && stackable.count > 1) {
    stackable.count -= 1;
  } else {
    const idx = inventory.items.indexOf(item);
    if (idx >= 0) inventory.items.splice(idx, 1);
    registry.destroyEntity(item);
  }

  return false;
}
