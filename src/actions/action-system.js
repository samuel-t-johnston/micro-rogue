import { executeMove } from './action-types/action-move.js';
import { executeInteract } from './action-types/action-interact.js';
import { executePickup } from './action-types/action-pickup.js';
import { executeSelfInteract } from './action-types/action-self-interact.js';
import { buildPlanningContext } from '../ai/planning-context.js';
import { evaluateGoals } from '../ai/goal-evaluator.js';
import { playerAutoMove } from '../ai/goals/player-auto-move.js';
import { playerAutoPickup } from '../ai/goals/player-auto-pickup.js';
import { playerGetInput } from '../ai/goals/player-get-input.js';

const PLAYER_GOALS = [playerAutoMove, playerAutoPickup, playerGetInput];

// Returns Promise<boolean> — false = action consumed a turn, true = free action.
export function createActionSystem({ level, inputController, registry }) {
  // Action type → handler lookup. Add new action types here.
  const dispatch = {
    move:         (entity, action) => executeMove(entity, action, level),
    interact:     (entity, action) => executeInteract(entity, action, level, registry),
    pickup:       (entity, action) => executePickup(entity, action, level, registry),
    selfInteract: (entity, action) => executeSelfInteract(entity, action, level, registry),
  };

  function executeAction(entity, action) {
    const handler = dispatch[action?.type];
    return handler ? handler(entity, action) : false;
  }

  async function invokeAction(entity) {
    if (entity.components.has('playerControlled')) {
      const context = buildPlanningContext({ entity, level, inputController, turnCount: 0 });
      const result = await evaluateGoals(PLAYER_GOALS, context);
      return result?.action ? executeAction(entity, result.action) : false;
    }
    // Non-player entities with TurnTaker but no AI just pass their turn.
    return false;
  }

  return { invokeAction };
}
