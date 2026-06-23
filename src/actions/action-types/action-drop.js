import { components } from '../../world/components.js';
import { gameLog } from '../../engine/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log-text.js';

/**
 * Removes an item from the actor's inventory and places it on the map at the actor's tile.
 * @returns {boolean} Always `false` — dropping consumes the turn.
 */
export function executeDrop(actor, action, level, registry) {
  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  const item = inventory.items.find(e => e.id === action.itemEntityId);
  if (!item) return false;

  const pos = actor.components.get('position');
  if (!pos) return false;

  const idx = inventory.items.indexOf(item);
  if (idx >= 0) inventory.items.splice(idx, 1);

  item.components.get('item').location = { type: 'map' };
  if (item.components.has('position')) {
    const p = item.components.get('position');
    p.x = pos.x;
    p.y = pos.y;
  } else {
    registry.addComponent(item, 'position', components.position(pos.x, pos.y));
  }
  level.placeEntity(item);

  gameLog.add({
    actor: actor.id,
    action: 'drop',
    item: item.id,
    display: `${subject(actor)} ${conjugate(actor, 'drop', 'drops')} the ${itemName(item)}.`,
  });

  return false;
}
