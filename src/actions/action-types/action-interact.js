import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate, itemName } from '../../engine/log/text/log-text.js';

/**
 * Executes an interact action against an adjacent target entity, dispatching to container or door
 * behavior based on the target's components.
 * @returns {Promise<boolean>} `false` if the turn was consumed, `true` for a free action
 *   (cancelled, blocked, or nothing to do).
 */
export async function executeInteract(actor, action, level, registry, dialogController) {
  const target = registry.getEntity(action.targetEntityId);
  if (!target) return false;

  if (target.components.has('container')) {
    return executeContainerInteract(actor, target, dialogController, action.mode);
  }

  if (target.components.has('openable')) {
    return executeDoorInteract(actor, target, level, registry);
  }

  return false;
}

function executeDoorInteract(actor, target, level, registry) {
  const openable = target.components.get('openable');
  const renderable = target.components.get('renderable');

  if (openable.isOpen) {
    // An open door shares its tile with whatever stepped onto it. Closing the door on
    // an occupant would trap them inside the wall, so refuse — as a free action — and
    // name the blocker. Any non-door entity counts (a creature, a dropped item).
    const blocker = doorOccupant(target, level);
    if (blocker) {
      const name = (blocker.components.get('name') ?? 'thing').toLowerCase();
      gameLog.add({
        actor: actor.id,
        action: 'interact',
        target: target.id,
        interaction: 'door',
        blockedBy: blocker.id,
        display: `The ${name} blocks the door from closing.`,
      });
      return true;
    }

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

  // Debug-only (no `display`): records the toggle and resulting state.
  gameLog.add({
    actor: actor.id,
    action: 'interact',
    target: target.id,
    interaction: 'door',
    opened: openable.isOpen,
  });

  return false;
}

// Returns an entity sharing the door's tile, other than the door itself, or null.
function doorOccupant(door, level) {
  const pos = door.components.get('position');
  if (!pos || !level) return null;
  for (const entity of level.getEntitiesAt(pos.x, pos.y)) {
    if (entity !== door) return entity;
  }
  return null;
}

// Interacting with a container is two-faceted: the default (a tap, or the menu's "Open") takes items
// out; `mode === 'store'` (the menu's "Place items") puts the actor's own items in. Both share the
// multi-select dialog and the same turn rule: moving ≥1 item consumes the turn, cancel/empty is free.
async function executeContainerInteract(actor, target, dialogController, mode) {
  if (mode === 'store') return storeInContainer(actor, target, dialogController);

  // Debug-only (no `display`): the interaction itself, logged whenever the player
  // opens the container — even if it's empty or they cancel without taking anything.
  gameLog.add({
    actor: actor.id,
    action: 'interact',
    target: target.id,
    interaction: 'container',
  });

  const name = target.components.get('name') ?? 'Container';

  const containerInventory = target.components.get('inventory');
  if (!containerInventory || containerInventory.items.length === 0) {
    // Player-facing feedback so opening an empty container isn't a silent no-op (tap or menu alike).
    gameLog.add({
      actor: actor.id,
      action: 'interact',
      target: target.id,
      interaction: 'container',
      display: `The ${name.toLowerCase()} is empty.`,
    });
    return true;
  }

  const title = name;
  const result = await dialogController.showItemList({ title, items: containerInventory.items });

  if (!result.confirmed || result.taken.length === 0) return true;

  const actorInventory = actor.components.get('inventory');
  if (!actorInventory) return false;

  for (const item of result.taken) {
    const idx = containerInventory.items.indexOf(item);
    if (idx >= 0) containerInventory.items.splice(idx, 1);
    item.components.get('item').location = { type: 'inventory', ownerId: actor.id };
    actorInventory.items.push(item);

    // Player-facing: each item pulled out of the container is its own pickup line.
    gameLog.add({
      actor: actor.id,
      action: 'take',
      item: item.id,
      container: target.id,
      display: `${subject(actor)} ${conjugate(actor, 'take', 'takes')} the ${itemName(item)}.`,
    });
  }

  return false;
}

// Places selected items from the actor's inventory into the container. Mirror of the take path:
// the dialog lists the *actor's* items, and only an actual transfer spends the turn.
async function storeInContainer(actor, target, dialogController) {
  const actorInventory = actor.components.get('inventory');
  if (!actorInventory || actorInventory.items.length === 0) {
    // Empty-handed: a little feedback so the menu choice isn't a silent no-op.
    gameLog.add({
      actor: actor.id,
      action: 'store',
      target: target.id,
      display: 'You have nothing to put in.',
    });
    return true;
  }

  const containerName = target.components.get('name') ?? 'Container';
  const result = await dialogController.showItemList({
    title: `Place in ${containerName}`,
    items: actorInventory.items,
    confirmLabel: 'Place',
  });

  if (!result.confirmed || result.taken.length === 0) return true;

  const containerInventory = target.components.get('inventory');
  if (!containerInventory) return false;

  for (const item of result.taken) {
    const idx = actorInventory.items.indexOf(item);
    if (idx >= 0) actorInventory.items.splice(idx, 1);
    item.components.get('item').location = { type: 'container', containerId: target.id };
    containerInventory.items.push(item);

    // Player-facing: each item placed into the container is its own line.
    gameLog.add({
      actor: actor.id,
      action: 'store',
      item: item.id,
      container: target.id,
      display: `${subject(actor)} ${conjugate(actor, 'put', 'puts')} the ${itemName(item)} into the ${containerName.toLowerCase()}.`,
    });
  }

  return false;
}
