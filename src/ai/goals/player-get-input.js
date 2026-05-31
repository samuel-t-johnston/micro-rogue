import { findPath } from '../../world/pathfinding.js';

// Waits for player input and interprets it.
// Adjacent tap → immediate move.
// Distant tap → first move step + sets memory.autoMoveTarget for subsequent turns.
// Loops on invalid input (unreachable tile, tap on current tile) until a valid action is produced.
export const playerGetInput = {
  async evaluate(context) {
    const { memory, selfState, level, awaitInput, perception } = context;

    while (true) {
      const input = await awaitInput();

      if (input.type !== 'move') continue;

      const { x: px, y: py } = selfState.position;
      const dx = Math.abs(input.x - px);
      const dy = Math.abs(input.y - py);
      const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);

      if (isAdjacent) {
        return { action: { type: 'move', x: input.x, y: input.y } };
      }

      // Distant tap: pathfind and set up auto-move
      const path = findPath(selfState.position, { x: input.x, y: input.y }, level);
      if (!path || path.length === 0) continue;

      // Snapshot visible enemies so auto-move can detect new ones next turn
      memory.knownEnemyIds = perception.entities.filter(e => e.tags.isEnemy).map(e => e.entityId);
      memory.autoMoveTarget = { x: input.x, y: input.y };

      return { action: { type: 'move', x: path[0].x, y: path[0].y } };
    }
  },
};
