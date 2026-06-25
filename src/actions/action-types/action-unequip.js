import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';

/**
 * Removes the item in the given slot (`action.slot`) from the actor's equipment back into inventory.
 * @returns {boolean} Always `false` — unequipping consumes the turn.
 */
export function executeUnequip(actor, action, _level, _registry) {
  const wears = actor.components.get('wearsEquipment');
  if (!wears) return false;

  const { slot } = action;
  if (!(slot in wears.slots)) return false;

  const item = wears.slots[slot];
  if (!item) return false;

  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  wears.slots[slot] = null;
  item.components.get('item').location = { type: 'inventory', ownerId: actor.id };
  inventory.items.push(item);

  gameLog.add({
    actor: actor.id,
    action: 'unequip',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'unequip', 'unequips')} the ${itemName(item)}.`,
  });

  return false;
}
