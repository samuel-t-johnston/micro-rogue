// Evaluates a goal stack top-down. Each goal's evaluate() returns { action }
// to activate, or null to fall through to the next goal.
// Goals may mutate context.memory as a side effect even when not activating.
//
// onSelect, if given, is called with (goal, index) for the winning goal — used by
// callers to log which goal drove the entity's action this turn.
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
