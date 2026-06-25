import { executePickup } from './action-pickup.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';

/**
 * Handles a tap on the actor's own tile: travel via stairs underfoot, or pick up item(s) here
 * (a single item directly, multiple via a dialog).
 * @returns {Promise<boolean>} `true` (free action) if nothing was picked up or the dialog was
 *   cancelled; `false` (turn consumed) otherwise.
 */
export async function executeSelfInteract(actor, _action, level, registry, dialogController) {
  const pos = actor.components.get('position');

  // Stairs (a `transition` entity) underfoot take precedence: tapping your own tile travels. The
  // scene wired level.onTransition to perform the level swap (the action system can't, since it
  // closes over the level being left); we just request it and consume the turn.
  const transitionEntity = [...level.getEntitiesAt(pos.x, pos.y)].find((e) =>
    e.components.has('transition'),
  );
  if (transitionEntity && level.onTransition) {
    level.onTransition(transitionEntity);
    return false;
  }

  const itemsHere = [...level.getEntitiesAt(pos.x, pos.y)].filter((e) => e.components.has('item'));

  if (itemsHere.length === 0) return true;
  if (itemsHere.length === 1) {
    return executePickup(actor, { itemEntityId: itemsHere[0].id }, level, registry);
  }

  const result = await dialogController.showItemList({ title: 'Floor', items: itemsHere });
  if (!result.confirmed || result.taken.length === 0) return true;

  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  for (const item of result.taken) {
    level.removeEntity(item);
    item.components.get('item').location = { type: 'inventory', ownerId: actor.id };
    inventory.items.push(item);

    // Player-facing: each item lifted off the floor is its own pickup line,
    // mirroring the single-item path's executePickup log.
    gameLog.add({
      actor: actor.id,
      action: 'pickup',
      item: item.id,
      display: `${subject(actor)} ${conjugate(actor, 'pick up', 'picks up')} the ${itemName(item)}.`,
    });
  }

  return false;
}
