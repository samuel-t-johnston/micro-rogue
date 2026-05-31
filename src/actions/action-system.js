import { executeMove } from './action-types/action-move.js';

// Returns Promise<boolean> — false = action consumed a turn, true = free action.
export function createActionSystem({ level, inputController }) {
  const dispatch = {
    move: (entity, action) => executeMove(entity, action, level),
  };

  function executeAction(entity, action) {
    const handler = dispatch[action?.type];
    return handler ? handler(entity, action) : false;
  }

  async function invokeAction(entity) {
    if (entity.components.has('playerControlled')) {
      const action = await inputController.waitForInput();
      return executeAction(entity, action);
    }
    // Non-player entities with TurnTaker but no AI just pass their turn.
    return false;
  }

  return { invokeAction };
}
