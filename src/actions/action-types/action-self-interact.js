import { executePickup } from './action-pickup.js';

// Handles a tap on the actor's own tile.
// Returns true (free action) if nothing to pick up; false (costs a turn) if an item was picked up.
export function executeSelfInteract(actor, _action, level, registry) {
  const pos = actor.components.get('position');
  const itemsHere = [...level.getEntitiesAt(pos.x, pos.y)].filter(e => e.components.has('item'));

  if (itemsHere.length === 0) return true;
  if (itemsHere.length === 1) {
    return executePickup(actor, { itemEntityId: itemsHere[0].id }, level, registry);
  }
  // Multiple items: wait for inventory selection UI
  return true;
}
