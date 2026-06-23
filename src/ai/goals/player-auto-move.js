import { findPath } from '../../world/pathfinding.js';
import { areHostile } from '../../combat/factions.js';

// Delay between auto-move steps so each move is visible and the player has
// time to tap to interrupt. Does not affect single adjacent-tile moves.
const AUTO_MOVE_DELAY_MS = 150;

// Clears all auto-move state from memory.
function cancelAutoMove(memory) {
  delete memory.autoMoveTarget;
  delete memory.knownEnemyIds;
}

/**
 * Player goal: steps one tile per turn toward `memory.autoMoveTarget`, cancelling (and clearing the
 * target) if a player input is buffered (tap/key during auto-move), a new enemy enters vision, the
 * target is reached, or no path exists. A short delay between steps keeps each move visible and
 * interruptible.
 */
export const playerAutoMove = {
  async evaluate(context) {
    const { memory, perception, selfState, level, hasPendingInput } = context;
    const target = memory.autoMoveTarget;

    if (!target) return null;

    // Cancel: player tapped or pressed something while auto-moving
    if (hasPendingInput()) {
      cancelAutoMove(memory);
      return null;
    }

    // Cancel: a new enemy entered vision since auto-move started
    const visibleEnemyIds = new Set(perception.entities
      .filter(e => e.tags.isActor && areHostile(selfState.factions, e.factions))
      .map(e => e.entityId));
    const knownEnemyIds = new Set(memory.knownEnemyIds ?? []);
    const hasNewEnemy = [...visibleEnemyIds].some(id => !knownEnemyIds.has(id));

    if (hasNewEnemy) {
      cancelAutoMove(memory);
      return null;
    }

    // Cancel: reached target
    if (selfState.position.x === target.x && selfState.position.y === target.y) {
      cancelAutoMove(memory);
      return null;
    }

    // Cancel: no path to target
    const path = findPath(selfState.position, target, level);
    if (!path || path.length === 0) {
      cancelAutoMove(memory);
      return null;
    }

    memory.knownEnemyIds = [...visibleEnemyIds];

    await new Promise(r => setTimeout(r, AUTO_MOVE_DELAY_MS));

    // Re-check for a tap that arrived during the delay
    if (hasPendingInput()) {
      cancelAutoMove(memory);
      return null;
    }

    return { action: { type: 'move', x: path[0].x, y: path[0].y } };
  },
};
