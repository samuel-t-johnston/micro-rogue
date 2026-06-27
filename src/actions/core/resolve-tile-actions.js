/**
 * @file The single source of truth for "what can the player do to this tile?", primary action first.
 * Shared by the tap interpreter (player-get-input takes element [0]) and the contextual menu (lists
 * them all), so the two can never drift. Pure: reads the level + a player position and returns plain
 * descriptors — it neither pathfinds nor mutates (distant-move pathfinding stays in the goal).
 *
 * Default-action policy (element [0]) of note: an *open* door defaults to moving through it, with
 * "Close" offered second; a *closed* door defaults to opening it. See docs/design/ux-design.md.
 */

const nameOf = (e) => e.components.get('name') ?? 'thing';

// The actor's own tile's *primary* interaction: pick up / take stairs. Returns null when there's
// nothing underfoot; the self tile then falls back to Wait (added by the caller), which is always
// offered so the player can deliberately pass a turn.
function selfAction(occupants) {
  const stairs = occupants.find((e) => e.components.has('transition'));
  if (stairs) {
    const down = stairs.components.get('transition').port === 'down';
    return {
      id: 'self',
      label: down ? 'Descend' : 'Ascend',
      action: { type: 'selfInteract' },
      free: false,
    };
  }
  const items = occupants.filter((e) => e.components.has('item'));
  if (items.length === 1) {
    return {
      id: 'self',
      label: `Pick up the ${nameOf(items[0])}`,
      action: { type: 'selfInteract' },
      free: false,
    };
  }
  if (items.length > 1) {
    return { id: 'self', label: 'Pick up items', action: { type: 'selfInteract' }, free: false };
  }
  return null;
}

/**
 * @typedef {object} TileAction
 * @property {string} id - Stable identifier (menu keys / tests).
 * @property {string} label - Player-facing menu text.
 * @property {object} action - The concrete game action to submit; the action system dispatches by `type`.
 * @property {boolean} free - Hint that the action won't consume a turn (look-at, etc.); informational for now.
 */

/**
 * Resolves the ordered list of actions available on a tile, primary action first.
 * @param {object} level - The current level.
 * @param {{x: number, y: number}} playerPos - The player's tile (0-indexed).
 * @param {{x: number, y: number}} tile - The target tile (0-indexed).
 * @returns {TileAction[]} Available actions, primary first; always ends with a free "Look".
 */
export function resolveTileActions(level, playerPos, tile) {
  const { x, y } = tile;
  const dx = Math.abs(x - playerPos.x);
  const dy = Math.abs(y - playerPos.y);
  const isSelf = dx === 0 && dy === 0;
  const isAdjacent = !isSelf && dx <= 1 && dy <= 1;

  const occupants = [...level.getEntitiesAt(x, y)];
  const creature = occupants.find((e) => e.components.has('health'));
  const door = occupants.find((e) => e.components.has('openable'));
  const container = occupants.find((e) => e.components.has('container'));
  const passable = level.isPassable(x, y);

  const moveRow = () => ({
    id: 'move',
    label: door?.components.get('openable').isOpen ? `Go through the ${nameOf(door)}` : 'Move here',
    action: { type: 'move', x, y },
    free: false,
  });
  const interactRow = (id, verb, target) => ({
    id,
    label: `${verb} the ${nameOf(target)}`,
    action: { type: 'interact', targetEntityId: target.id },
    free: false,
  });

  const actions = [];

  if (isSelf) {
    const self = selfAction(occupants);
    if (self) actions.push(self);
    // Wait is always offered on the player's own tile: it's the tap fallback when there's nothing
    // else underfoot, and a deliberate "pass the turn" option in the contextual menu either way.
    actions.push({ id: 'wait', label: 'Wait', action: { type: 'wait' }, free: false });
  } else if (isAdjacent) {
    if (creature) {
      actions.push({
        id: 'attack',
        label: `Attack the ${nameOf(creature)}`,
        action: { type: 'attack', targetEntityId: creature.id },
        free: false,
      });
    }
    if (door) {
      if (door.components.get('openable').isOpen) {
        if (passable) actions.push(moveRow()); // open door defaults to passing through
        actions.push(interactRow('close', 'Close', door));
      } else {
        actions.push(interactRow('open', 'Open', door)); // closed door defaults to opening
      }
    }
    if (container) {
      actions.push(interactRow('open-container', 'Open', container));
      // Secondary, menu-only: place items in. A raw tap takes the primary (open) row; storing is a
      // deliberate choice. Always offered (no-op if the player is carrying nothing) — resolveTileActions
      // is positional and doesn't see the inventory, and the store handler is free when there's nothing.
      actions.push({
        id: 'store',
        label: 'Place items',
        action: { type: 'interact', targetEntityId: container.id, mode: 'store' },
        free: false,
      });
    }
    if (passable && !door) actions.push(moveRow());
  } else if (passable) {
    actions.push(moveRow()); // distant tile — the goal turns this into auto-move
  }

  // Examine is offered on every tile, last (lowest priority). It's a free action and menu-only —
  // the tap interpreter skips it — so a plain tap never examines, but the menu never opens empty.
  actions.push({ id: 'look', label: 'Look', action: { type: 'lookAt', x, y }, free: true });
  return actions;
}
