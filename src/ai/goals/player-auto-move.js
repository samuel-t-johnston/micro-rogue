import { findPath } from '../../world/map/pathfinding.js';
import { diff } from '../senses/salience-monitor.js';

// Delay between auto-move steps so each move is visible and the player has
// time to tap to interrupt. Does not affect single adjacent-tile moves.
const AUTO_MOVE_DELAY_MS = 150;

// Clears all auto-move state from memory.
function cancelAutoMove(memory) {
  delete memory.autoMoveTarget;
  delete memory.autoMoveBaseline;
}

/**
 * Player goal: steps one tile per turn toward `memory.autoMoveTarget`, cancelling (and clearing the
 * target) if a player input is buffered (tap/key during auto-move), the salience monitor flags an
 * alert-worthy change (a new hostile enters perception, or the player's HP drops — the latter catching
 * known and out-of-vision attackers the new-enemy check alone would miss), the target is reached, or no
 * path exists. The baseline is fixed at arming (player-get-input), so any alert cancels. A short delay
 * between steps keeps each move visible and interruptible.
 */
export const playerAutoMove = {
  async evaluate(context) {
    const { memory, selfState, level, hasPendingInput } = context;
    const target = memory.autoMoveTarget;

    if (!target) return null;

    // Cancel: player tapped or pressed something while auto-moving
    if (hasPendingInput()) {
      cancelAutoMove(memory);
      return null;
    }

    // Cancel: the settled world changed in an alert-worthy way since auto-move armed
    if (diff(memory.autoMoveBaseline, context).alerted) {
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

    await new Promise((r) => setTimeout(r, AUTO_MOVE_DELAY_MS));

    // Re-check for a tap that arrived during the delay
    if (hasPendingInput()) {
      cancelAutoMove(memory);
      return null;
    }

    return { action: { type: 'move', x: path[0].x, y: path[0].y } };
  },
};
