import { executeMove } from './action-types/action-move.js';
import { executeInteract } from './action-types/action-interact.js';
import { executePickup } from './action-types/action-pickup.js';
import { executeSelfInteract } from './action-types/action-self-interact.js';
import { executeEquip } from './action-types/action-equip.js';
import { executeUnequip } from './action-types/action-unequip.js';
import { executeConsume } from './action-types/action-consume.js';
import { executeDrop } from './action-types/action-drop.js';
import { executeWait } from './action-types/action-wait.js';
import { executeAttack } from './action-types/action-attack.js';
import { executeShout } from './action-types/action-shout.js';
import { buildPlanningContext } from '../ai/planning-context.js';
import { evaluateGoals } from '../ai/goal-evaluator.js';
import { resolveGoals } from '../ai/goals/goal-registry.js';
import { gameLog } from '../engine/game-log.js';

// Returns Promise<boolean> — false = action consumed a turn, true = free action.
export function createActionSystem({ level, inputController, registry, dialogController }) {
  // Action type → handler lookup. Add new action types here.
  const dispatch = {
    move:         (entity, action) => executeMove(entity, action, level, registry),
    interact:     (entity, action) => executeInteract(entity, action, level, registry, dialogController),
    pickup:       (entity, action) => executePickup(entity, action, level, registry),
    selfInteract: (entity, action) => executeSelfInteract(entity, action, level, registry, dialogController),
    equip:        (entity, action) => executeEquip(entity, action, level, registry),
    unequip:      (entity, action) => executeUnequip(entity, action, level, registry),
    consume:      (entity, action) => executeConsume(entity, action, level, registry),
    drop:         (entity, action) => executeDrop(entity, action, level, registry),
    wait:         () => executeWait(),
    attack:       (entity, action) => executeAttack(entity, action, level, registry),
    shout:        (entity, action) => executeShout(entity, action, level, registry),
  };

  async function executeAction(entity, action) {
    const handler = dispatch[action?.type];
    return handler ? await handler(entity, action) : false;
  }

  async function invokeAction(entity) {
    // Decay entities (sounds, future gas/timed effects) age one turn per pass and self-destruct at
    // 0. Handled here, where level/registry are in scope, so the turn manager keeps its clean
    // injected boundary. A destroyed entity is dropped from the queue by the next rescan.
    const decay = entity.components.get('decay');
    if (decay) {
      decay.lifespan -= 1;
      if (decay.lifespan <= 0) {
        level.removeEntity(entity);
        registry.destroyEntity(entity);
        return false;
      }
    }

    // The ai component holds an ordered goal stack; the player and NPCs go through
    // the same path. An entity with a TurnTaker but no ai just passes its turn.
    const ai = entity.components.get('ai');
    if (!ai) return false;
    const context = buildPlanningContext({ entity, level, inputController, turnCount: 0 });
    const result = await evaluateGoals(resolveGoals(ai.goals), context, (_goal, i) => {
      // Record the goal driving this turn on the component (read by the debug goal
      // inspector). Emit a debug-only goalChange entry (no `display`) only when it
      // changes, so the log shows *why* a creature's behavior shifted without an
      // entry every single turn.
      const newGoal = ai.goals[i];
      const prevGoal = ai.lastGoal;
      ai.lastGoal = newGoal;
      if (newGoal !== prevGoal) {
        gameLog.add({
          actor: entity.id,
          actorName: entity.components.get('name'),
          action: 'goalChange',
          prevGoal,
          newGoal,
        });
      }
    });
    return result?.action ? await executeAction(entity, result.action) : false;
  }

  return { invokeAction };
}
