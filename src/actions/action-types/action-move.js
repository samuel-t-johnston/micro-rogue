// Validates and executes a move to (action.x, action.y).
// Returns false (action consumed a turn) or true (free action — not used here).
export function executeMove(entity, action, level) {
  if (!level.isPassable(action.x, action.y)) return false;
  level.moveEntity(entity, action.x, action.y);
  return false;
}
