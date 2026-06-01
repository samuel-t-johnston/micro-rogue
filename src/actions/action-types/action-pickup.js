// Removes an item from the level and places it in the actor's inventory.
// Returns false — pickup always consumes a turn.
export function executePickup(actor, action, level, registry) {
  const item = registry.getEntitiesWith('item').find(e => e.id === action.itemEntityId);
  if (!item) return false;

  const itemComp = item.components.get('item');
  const inventory = actor.components.get('inventory');
  if (!inventory) return false;

  level.removeEntity(item);
  itemComp.location = { type: 'inventory', ownerId: actor.id };
  inventory.items.push(item);

  return false;
}
