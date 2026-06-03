import { executePickup } from './action-pickup.js';

// Handles a tap on the actor's own tile.
// Returns true (free action) if nothing picked up or dialog cancelled; false (turn consumed) otherwise.
export async function executeSelfInteract(actor, _action, level, registry, dialogController) {
  const pos = actor.components.get('position');
  const itemsHere = [...level.getEntitiesAt(pos.x, pos.y)].filter(e => e.components.has('item'));

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
  }

  return false;
}
