import { findPath } from '../../world/pathfinding.js';
import { areHostile } from '../../combat/factions.js';

// Waits for player input and interprets it.
// Adjacent tap → immediate move.
// Distant tap → first move step + sets memory.autoMoveTarget for subsequent turns.
// Loops on invalid input (unreachable tile, tap on current tile) until a valid action is produced.
export const playerGetInput = {
  async evaluate(context) {
    const { memory, selfState, level, awaitInput, perception } = context;

    while (true) {
      const input = await awaitInput();

      if (input.type === 'equip' || input.type === 'unequip' ||
          input.type === 'consume' || input.type === 'drop') {
        return { action: input };
      }

      if (input.type !== 'move') continue;

      const { x: px, y: py } = selfState.position;
      const dx = Math.abs(input.x - px);
      const dy = Math.abs(input.y - py);
      const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);

      if (dx === 0 && dy === 0) {
        return { action: { type: 'selfInteract' } };
      }

      if (isAdjacent) {
        const occupants = [...level.getEntitiesAt(input.x, input.y)];
        // Tapping an adjacent creature attacks it. No allies exist yet, so any creature
        // with health is a valid target (the player may make questionable choices).
        const creature = occupants.find(e => e.components.has('health'));
        if (creature) {
          return { action: { type: 'attack', targetEntityId: creature.id } };
        }
        const interactable = occupants
          .find(e => e.components.has('openable') || e.components.has('container'));
        if (interactable) {
          return { action: { type: 'interact', targetEntityId: interactable.id } };
        }
        // Tapping a blocked adjacent tile (wall, furniture) with nothing to interact with
        // is invalid input — keep waiting rather than burning the turn.
        if (!level.isPassable(input.x, input.y)) continue;
        return { action: { type: 'move', x: input.x, y: input.y } };
      }

      // Distant tap: pathfind and set up auto-move
      const path = findPath(selfState.position, { x: input.x, y: input.y }, level);
      if (!path || path.length === 0) continue;

      // Snapshot visible enemies so auto-move can detect new ones next turn
      memory.knownEnemyIds = perception.entities
        .filter(e => e.tags.isActor && areHostile(selfState.factions, e.factions))
        .map(e => e.entityId);
      memory.autoMoveTarget = { x: input.x, y: input.y };

      return { action: { type: 'move', x: path[0].x, y: path[0].y } };
    }
  },
};
