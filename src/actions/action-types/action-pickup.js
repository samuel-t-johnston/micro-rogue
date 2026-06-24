import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/log-text.js';

/**
 * Removes an item from the level and places it in the actor's inventory.
 * @returns {boolean} Always `false` — picking up consumes the turn.
 */
export function executePickup(actor, action, level, registry) {
  const item = registry.getEntitiesWith('item').find((e) => e.id === action.itemEntityId);
  if (!item) return false;

  const itemComp = item.components.get('item');
  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  level.removeEntity(item);
  itemComp.location = { type: 'inventory', ownerId: actor.id };
  inventory.items.push(item);

  gameLog.add({
    actor: actor.id,
    action: 'pickup',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'pick up', 'picks up')} the ${itemName(item)}.`,
  });

  return false;
}
