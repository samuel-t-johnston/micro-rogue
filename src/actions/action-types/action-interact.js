// Executes an interact action against an adjacent target entity.
// Dispatches to container or door behavior based on the target's components.
// Returns false (turn consumed) or true (free action — cancelled or nothing to do).
export async function executeInteract(actor, action, _level, registry, dialogController) {
  const target = registry.getEntity(action.targetEntityId);
  if (!target) return false;

  if (target.components.has('container')) {
    return executeContainerInteract(actor, target, dialogController);
  }

  if (target.components.has('openable')) {
    return executeDoorInteract(target, registry);
  }

  return false;
}

function executeDoorInteract(target, registry) {
  const openable = target.components.get('openable');
  const renderable = target.components.get('renderable');

  if (openable.isOpen) {
    openable.isOpen = false;
    registry.addComponent(target, 'blocksMovement', {});
    registry.addComponent(target, 'opaque', {});
    if (renderable) renderable.sprite = openable.closedSprite;
  } else {
    openable.isOpen = true;
    registry.removeComponent(target, 'blocksMovement');
    registry.removeComponent(target, 'opaque');
    if (renderable) renderable.sprite = openable.openSprite;
  }

  return false;
}

async function executeContainerInteract(actor, target, dialogController) {
  const containerInventory = target.components.get('inventory');
  if (!containerInventory || containerInventory.items.length === 0) return true;

  const title = target.components.get('name') ?? 'Container';
  const result = await dialogController.showItemList({ title, items: containerInventory.items });

  if (!result.confirmed || result.taken.length === 0) return true;

  const actorInventory = actor.components.get('inventory');
  if (!actorInventory) return false;

  for (const item of result.taken) {
    const idx = containerInventory.items.indexOf(item);
    if (idx >= 0) containerInventory.items.splice(idx, 1);
    item.components.get('item').location = { type: 'inventory', ownerId: actor.id };
    actorInventory.items.push(item);
  }

  return false;
}
