/**
 * @file The single source of truth for "what can the player do to this tile?", primary action first.
 * Shared by the tap interpreter (player-get-input takes element [0]) and the contextual menu (lists
 * them all), so the two can never drift. Pure: reads the level + a player position and returns plain
 * descriptors — it neither pathfinds nor mutates (distant-move pathfinding stays in the goal).
 *
 * Default-action policy (element [0]) of note: an *open* door defaults to moving through it, with
 * "Close" offered second; a *closed* door defaults to opening it. See docs/design/ux-design.md.
 */
import { chebyshevDistance } from '../../world/map/geometry.js';
import { traceFlight } from './projectile-flight.js';
import { displayName } from '../../engine/log/text/log-text.js';

// A tile occupant's display name for pickup/interact labels — `displayName` appends a stack quantity
// for stackable items ("Arrow (20)"); a door or creature gets just its name.
const nameOf = (e) => displayName(e, 'thing');

// Whether the player can attack a creature on `tile` from `playerPos`, given the equipped weapon's
// reach (`capability` from getAttackCapability). A target within meleeRange is always reachable (you're
// on top of it, no line check); beyond that, out to range, it needs a clear straight line — the same
// flight trace a ranged attack flies, so "can I shoot it" and "where does the shot land" never disagree
// (traceFlight reaches the target tile only when nothing blocks the way short of it). See
// docs/design/ranged-weapons.md.
function isAttackable(level, playerPos, tile, distance, { range, meleeRange }) {
  if (distance === 0 || distance > range) return false;
  if (distance <= meleeRange) return true;
  const { impact } = traceFlight(level, playerPos.x, playerPos.y, tile.x, tile.y);
  return impact.x === tile.x && impact.y === tile.y;
}

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
 * @param {{range: number, meleeRange: number}} [capability] - The actor's attack reach (see
 *   getAttackCapability). Defaults to unarmed adjacent melee, so callers that don't pass it (and all
 *   non-combat behaviour) are unchanged.
 * @returns {TileAction[]} Available actions, primary first; always ends with a free "Look".
 */
export function resolveTileActions(
  level,
  playerPos,
  tile,
  capability = { range: 1, meleeRange: 1 },
) {
  const { x, y } = tile;
  const distance = chebyshevDistance(playerPos, tile);
  const isSelf = distance === 0;
  const isAdjacent = distance === 1;

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
  } else {
    // Attack a creature within reach — melee when adjacent, or a clear-line shot out to weapon range.
    // Offered at any distance (not just adjacent), so a tap on an in-range enemy fires. It's the
    // primary action, listed before the adjacent door/container/move interactions below.
    if (creature && isAttackable(level, playerPos, tile, distance, capability)) {
      actions.push({
        id: 'attack',
        label: `Attack the ${nameOf(creature)}`,
        action: { type: 'attack', targetEntityId: creature.id },
        free: false,
      });
    }
    if (isAdjacent) {
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
  }

  // Examine is offered on every tile, last (lowest priority). It's a free action and menu-only —
  // the tap interpreter skips it — so a plain tap never examines, but the menu never opens empty.
  actions.push({ id: 'look', label: 'Look', action: { type: 'lookAt', x, y }, free: true });
  return actions;
}
