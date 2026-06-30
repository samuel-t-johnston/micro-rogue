import { stackAll } from '../../world/entities/inventory-stacking.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate } from '../../engine/log/text/log-text.js';

/**
 * Consolidates every inventory stack matching the given item's type into as few stacks as possible
 * (pouring smaller stacks into larger, destroying emptied ones). A free inventory-management action:
 * it never costs a turn and only touches carried items. No-op when the item isn't in the inventory.
 * @returns {boolean} Always `true` — combining is free.
 */
export function executeStackAll(actor, action, _level, registry) {
  const inventory = actor.components.get('inventory');
  if (!inventory) return true;

  const item = inventory.items.find((e) => e.id === action.itemEntityId);
  if (!item?.components.has('stackable')) return true;

  // Capture the name before stacking: the tapped stack may itself be an emptied small one that
  // stackAll destroys (clearing its components), so reading it afterward would be unsafe.
  const name = (item.components.get('name') ?? 'item').toLowerCase();

  stackAll(inventory, item, registry);

  gameLog.add({
    actor: actor.id,
    action: 'stackAll',
    display: `${subject(actor)} ${conjugate(actor, 'stack', 'stacks')} the ${name}.`,
  });

  return true;
}
