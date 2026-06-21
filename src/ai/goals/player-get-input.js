import { findPath } from '../../world/pathfinding.js';
import { areHostile } from '../../combat/factions.js';
import { resolveTileActions } from '../../actions/resolve-tile-actions.js';

// Waits for player input and turns it into an action.
// A raw map `tap` is interpreted against the tile via resolveTileActions (attack / open / move / pick
// up / …) — the same resolver the contextual menu lists from, so taps and the menu never disagree.
// An explicit `move` (the menu's "Move here") routes straight to movement, never re-read as an attack.
// Already-resolved UI actions (equip, interact, …) pass straight through. Adjacent move → immediate;
// distant move → first step + memory.autoMoveTarget for subsequent turns. Loops on no-op input.

// Actions the UI submits already resolved (character menu, the contextual tile menu).
const PASS_THROUGH = new Set(['equip', 'unequip', 'consume', 'drop', 'interact', 'attack', 'selfInteract', 'lookAt']);

export const playerGetInput = {
  async evaluate(context) {
    const { memory, selfState, level, awaitInput, perception } = context;

    // Turn a movement target into an action: an adjacent step moves immediately; a distant tile
    // pathfinds and arms auto-move. Returns the action, or null to keep waiting (blocked/unreachable).
    const handleMove = (tx, ty) => {
      const dx = Math.abs(tx - selfState.position.x);
      const dy = Math.abs(ty - selfState.position.y);
      if (dx === 0 && dy === 0) return null;
      if (dx <= 1 && dy <= 1) {
        return level.isPassable(tx, ty) ? { type: 'move', x: tx, y: ty } : null;
      }
      const path = findPath(selfState.position, { x: tx, y: ty }, level);
      if (!path || path.length === 0) return null;
      // Snapshot visible enemies so auto-move can detect new ones next turn.
      memory.knownEnemyIds = perception.entities
        .filter(e => e.tags.isActor && areHostile(selfState.factions, e.factions))
        .map(e => e.entityId);
      memory.autoMoveTarget = { x: tx, y: ty };
      return { type: 'move', x: path[0].x, y: path[0].y };
    };

    while (true) {
      const input = await awaitInput();

      // Raw map tap: interpret it against the tile, act on the primary action. Skip the always-present
      // free 'lookAt' row — examining is menu-only, so a plain tap on a wall/empty stays a no-op.
      if (input.type === 'tap') {
        const primary = resolveTileActions(level, selfState.position, input).find(r => r.action.type !== 'lookAt');
        if (!primary) continue;
        if (primary.action.type === 'move') {
          const move = handleMove(primary.action.x, primary.action.y);
          if (move) return { action: move };
          continue;
        }
        return { action: primary.action };
      }

      // Explicit move (e.g. the contextual menu's "Move here") — never re-interpreted as an attack.
      if (input.type === 'move') {
        const move = handleMove(input.x, input.y);
        if (move) return { action: move };
        continue;
      }

      if (PASS_THROUGH.has(input.type)) return { action: input };
      // Anything else (stale/unknown input) is ignored; keep waiting.
    }
  },
};
