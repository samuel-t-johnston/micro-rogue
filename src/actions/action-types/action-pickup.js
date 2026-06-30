import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';
import { addToInventory } from '../../world/entities/inventory-stacking.js';

/**
 * Removes an item from the level and places it in the actor's inventory, merging it into an existing
 * stack of the same type when one has room (so retrieved arrows/javelins restack instead of piling up
 * as separate count-1 stacks).
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

  // Built before merging: a fully-absorbed stack is destroyed (its name cleared) by addToInventory.
  const display = `${subject(actor)} ${conjugate(actor, 'pick up', 'picks up')} the ${itemName(item)}.`;
  addToInventory(inventory, item, registry);

  gameLog.add({ actor: actor.id, action: 'pickup', item: item.id, display });

  return false;
}
