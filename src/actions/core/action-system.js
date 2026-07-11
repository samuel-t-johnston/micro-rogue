import { executeMove } from '../action-types/action-move.js';
import { executeInteract } from '../action-types/action-interact.js';
import { executePickup } from '../action-types/action-pickup.js';
import { executeSelfInteract } from '../action-types/action-self-interact.js';
import { executeEquip } from '../action-types/action-equip.js';
import { executeUnequip } from '../action-types/action-unequip.js';
import { executeConsume } from '../action-types/action-consume.js';
import { executeDrop } from '../action-types/action-drop.js';
import { executeSplit } from '../action-types/action-split.js';
import { executeStackAll } from '../action-types/action-stack-all.js';
import { executeWait } from '../action-types/action-wait.js';
import { executeThrow } from '../action-types/action-throw.js';
import { executeAttack } from '../action-types/action-attack.js';
import { executeLookAt } from '../action-types/action-look.js';
import { executeShout } from '../action-types/action-shout.js';
import { buildPlanningContext } from '../../ai/core/planning-context.js';
import { evaluateGoals } from '../../ai/core/goal-evaluator.js';
import { resolveGoals } from '../../ai/goals/goal-registry.js';
import { gameLog } from '../../engine/log/game-log.js';

/**
 * Creates the action system: a type→handler dispatch table plus the per-entity `invokeAction`
 * the turn manager calls each turn (it runs goal planning, then executes the chosen action).
 * Register new action types in the `dispatch` table.
 * @returns {{ invokeAction: (entity: object) => Promise<boolean> }} `invokeAction` resolves
 *   `false` if the action consumed the turn, `true` for a free action.
 */
export function createActionSystem({
  level,
  inputController,
  registry,
  dialogController,
  onPlayerContext,
}) {
  // Action type → handler lookup. Add new action types here.
  const dispatch = {
    move: (entity, action) => executeMove(entity, action, level, registry),
    interact: (entity, action) =>
      executeInteract(entity, action, level, registry, dialogController),
    pickup: (entity, action) => executePickup(entity, action, level, registry),
    selfInteract: (entity, action) =>
      executeSelfInteract(entity, action, level, registry, dialogController),
    equip: (entity, action) => executeEquip(entity, action, level, registry),
    unequip: (entity, action) => executeUnequip(entity, action, level, registry),
    consume: (entity, action) => executeConsume(entity, action, level, registry),
    drop: (entity, action) => executeDrop(entity, action, level, registry),
    split: (entity, action) => executeSplit(entity, action, level, registry),
    stackAll: (entity, action) => executeStackAll(entity, action, level, registry),
    wait: () => executeWait(),
    throw: (entity, action) => executeThrow(entity, action, level, registry),
    attack: (entity, action) => executeAttack(entity, action, level, registry),
    lookAt: (entity, action) => executeLookAt(entity, action, level),
    shout: (entity, action) => executeShout(entity, action, level, registry),
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
    const context = buildPlanningContext({
      entity,
      level,
      inputController,
      turnCount: entity.components.get('turnTaker')?.actCount ?? 0,
    });
    // Non-goal observers of the player's freshly-settled perception (the in-menu salience alert today;
    // auto-rest / travel / the notification layer later). Fired here — after the context is built,
    // before goals run — so an alert lands the instant control returns, not gated behind the player's
    // next input. Player-only, and can't act: it observes, it doesn't decide the turn. See
    // docs/design/state-change-alerts.md (the minimal seed of the deferred perception-reporter pass).
    if (entity.components.has('playerControlled')) onPlayerContext?.(context);
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
