import { findPath } from '../../world/pathfinding.js';

// Delay between auto-move steps so each move is visible and the player has
// time to tap to interrupt. Does not affect single adjacent-tile moves.
const AUTO_MOVE_DELAY_MS = 150;

// Executes one step per turn toward memory.autoMoveTarget.
// Cancels (clears target, returns null) if:
//   - a buffered player input is waiting (tap/key during auto-move)
//   - a new enemy has appeared in vision since auto-move started
//   - the target has been reached
//   - no path exists to the target
export const playerAutoMove = {
  async evaluate(context) {
    const { memory, perception, selfState, level, hasPendingInput } = context;
    const target = memory.autoMoveTarget;

    if (!target) return null;

    // Cancel: player tapped or pressed something while auto-moving
    if (hasPendingInput()) {
      delete memory.autoMoveTarget;
      delete memory.knownEnemyIds;
      return null;
    }

    // Cancel: a new enemy entered vision since auto-move started
    const visibleEnemyIds = new Set(perception.entities.filter(e => e.tags.isEnemy).map(e => e.entityId));
    const knownEnemyIds = new Set(memory.knownEnemyIds ?? []);
    const hasNewEnemy = [...visibleEnemyIds].some(id => !knownEnemyIds.has(id));

    if (hasNewEnemy) {
      delete memory.autoMoveTarget;
      delete memory.knownEnemyIds;
      return null;
    }

    // Cancel: reached target
    if (selfState.position.x === target.x && selfState.position.y === target.y) {
      delete memory.autoMoveTarget;
      delete memory.knownEnemyIds;
      return null;
    }

    // Cancel: no path to target
    const path = findPath(selfState.position, target, level);
    if (!path || path.length === 0) {
      delete memory.autoMoveTarget;
      delete memory.knownEnemyIds;
      return null;
    }

    memory.knownEnemyIds = [...visibleEnemyIds];

    await new Promise(r => setTimeout(r, AUTO_MOVE_DELAY_MS));

    // Re-check for a tap that arrived during the delay
    if (hasPendingInput()) {
      delete memory.autoMoveTarget;
      delete memory.knownEnemyIds;
      return null;
    }

    return { action: { type: 'move', x: path[0].x, y: path[0].y } };
  },
};
