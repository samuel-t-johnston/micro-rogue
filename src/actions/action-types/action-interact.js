// Executes an interact action against a target entity (e.g. opening/closing a door).
// Returns false — interact always consumes a turn.
export function executeInteract(_entity, action, _level, registry) {
  const target = registry.getEntitiesWith('openable').find(e => e.id === action.targetEntityId);
  if (!target) return false;

  const openable = target.components.get('openable');
  const renderable = target.components.get('renderable');

  // Right now, this assumes door behavior always applies.
  // In the future, we may want to support other interactable entities with different 
  // behavior; if so, we'll need a more flexible system for defining interact behavior 
  // on a per-entity basis.
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
