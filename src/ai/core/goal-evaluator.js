/**
 * @typedef {{ action: object }} GoalResult
 * A goal's decision for the turn — the action to take. A goal returns `null` instead to fall through.
 */

/**
 * @typedef {object} Goal
 * @property {(context: import('./planning-context.js').PlanningContext) => (GoalResult | null | Promise<GoalResult | null>)} evaluate
 *   Decides this turn: return a GoalResult to act, or null to fall through to the next goal. May
 *   mutate `context.memory` as a side effect even when returning null.
 */

/**
 * Evaluates a goal stack top-down: the first goal whose evaluate() returns non-null wins, and its
 * result is returned. Goals may mutate context.memory even when they fall through.
 * @param {Goal[]} goals - Ordered by priority (highest first).
 * @param {import('./planning-context.js').PlanningContext} context
 * @param {(goal: Goal, index: number) => void} [onSelect] - Called with the winning goal and its index.
 * @returns {Promise<GoalResult | null>}
 */
export async function evaluateGoals(goals, context, onSelect) {
  for (let i = 0; i < goals.length; i++) {
    const result = await goals[i].evaluate(context);
    if (result !== null) {
      onSelect?.(goals[i], i);
      return result;
    }
  }
  return null;
}
