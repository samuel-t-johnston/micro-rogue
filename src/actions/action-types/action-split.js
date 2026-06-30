import { splitStack } from '../../world/entities/stacking.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';

/**
 * Splits `action.quantity` units off a stacked inventory item into a separate stack in the same
 * inventory. A free inventory-management action: it never costs a turn and only ever touches items the
 * actor is carrying (equipped stacks live in equipment slots, not the inventory, so they're excluded
 * by construction). The quantity must satisfy `1 ≤ quantity < count`; anything else is a no-op.
 * @returns {boolean} Always `true` — splitting is free.
 */
export function executeSplit(actor, action, _level, registry) {
  const inventory = actor.components.get('inventory');
  if (!inventory) return true;

  const item = inventory.items.find((e) => e.id === action.itemEntityId);
  const stack = item?.components.get('stackable');
  if (!stack) return true;

  const n = action.quantity;
  if (!Number.isInteger(n) || n < 1 || n >= stack.count) return true;

  const split = splitStack(item, n, registry);
  split.components.get('item').location = { type: 'inventory', ownerId: actor.id };
  inventory.items.push(split);

  gameLog.add({
    actor: actor.id,
    action: 'split',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'split off', 'splits off')} the ${itemName(split)}.`,
  });

  return true;
}
