// The single source of truth for "what can the player do to this tile?", primary action first.
// Shared by the tap interpreter (player-get-input takes element [0]) and the contextual menu (lists
// them all), so the two can never drift. Pure: reads the level + a player position and returns plain
// descriptors — it neither pathfinds nor mutates (distant-move pathfinding stays in the goal).
//
// Each entry: { id, label, action, free }
//   id     — stable identifier (menu keys / tests)
//   label  — player-facing menu text
//   action — the concrete game action to submit; the action system dispatches these by type
//   free   — hint that the action won't consume a turn (look-at, etc.); informational for now
//
// Default-action policy (element [0]) of note: an *open* door defaults to moving through it, with
// "Close" offered second; a *closed* door defaults to opening it. See docs/design/ux-design.md.

const nameOf = (e) => e.components.get('name') ?? 'thing';

// The actor's own tile: pick up / take stairs. Returns null when there's nothing to do, so a tap on
// an empty self-tile resolves to no action (the goal keeps waiting) rather than a misleading row.
function selfAction(occupants) {
  const stairs = occupants.find(e => e.components.has('transition'));
  if (stairs) {
    const down = stairs.components.get('transition').port === 'down';
    return { id: 'self', label: down ? 'Descend' : 'Ascend', action: { type: 'selfInteract' }, free: false };
  }
  const items = occupants.filter(e => e.components.has('item'));
  if (items.length === 1) {
    return { id: 'self', label: `Pick up the ${nameOf(items[0])}`, action: { type: 'selfInteract' }, free: false };
  }
  if (items.length > 1) {
    return { id: 'self', label: 'Pick up items', action: { type: 'selfInteract' }, free: false };
  }
  return null;
}

export function resolveTileActions(level, playerPos, tile) {
  const { x, y } = tile;
  const dx = Math.abs(x - playerPos.x);
  const dy = Math.abs(y - playerPos.y);
  const isSelf = dx === 0 && dy === 0;
  const isAdjacent = !isSelf && dx <= 1 && dy <= 1;

  const occupants = [...level.getEntitiesAt(x, y)];
  const creature = occupants.find(e => e.components.has('health'));
  const door = occupants.find(e => e.components.has('openable'));
  const container = occupants.find(e => e.components.has('container'));
  const passable = level.isPassable(x, y);

  const moveRow = () => ({
    id: 'move',
    label: door?.components.get('openable').isOpen ? `Go through the ${nameOf(door)}` : 'Move here',
    action: { type: 'move', x, y },
    free: false,
  });
  const interactRow = (id, verb, target) => ({
    id, label: `${verb} the ${nameOf(target)}`, action: { type: 'interact', targetEntityId: target.id }, free: false,
  });

  const actions = [];

  if (isSelf) {
    const self = selfAction(occupants);
    if (self) actions.push(self);
    return actions;
  }

  if (isAdjacent) {
    if (creature) {
      actions.push({ id: 'attack', label: `Attack the ${nameOf(creature)}`, action: { type: 'attack', targetEntityId: creature.id }, free: false });
    }
    if (door) {
      if (door.components.get('openable').isOpen) {
        if (passable) actions.push(moveRow());   // open door defaults to passing through
        actions.push(interactRow('close', 'Close', door));
      } else {
        actions.push(interactRow('open', 'Open', door));   // closed door defaults to opening
      }
    }
    if (container) actions.push(interactRow('open-container', 'Open', container));
    if (passable && !door) actions.push(moveRow());
    return actions;
  }

  // Distant tile: only movement (the goal turns it into auto-move). Look-at lands here later.
  if (passable) actions.push(moveRow());
  return actions;
}
