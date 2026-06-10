import { gameLog } from '../../engine/game-log.js';

// Validates and executes a move to (action.x, action.y).
// Returns false (action consumed a turn) or true (free action — not used here).
export function executeMove(entity, action, level) {
  if (!level.isPassable(action.x, action.y)) return false;

  const from = entity.components.get('position');
  // Debug-only entry (no `display`): tracing where each entity went is useful for
  // following AI behavior, but never surfaces in the player-facing log.
  gameLog.add({
    actor: entity.id,
    actorName: entity.components.get('name'),
    action: 'move',
    from: from ? { x: from.x, y: from.y } : null,
    to: { x: action.x, y: action.y },
  });

  level.moveEntity(entity, action.x, action.y);
  return false;
}
