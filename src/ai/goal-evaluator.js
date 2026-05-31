// Evaluates a goal stack top-down. Each goal's evaluate() returns { action }
// to activate, or null to fall through to the next goal.
// Goals may mutate context.memory as a side effect even when not activating.
export async function evaluateGoals(goals, context) {
  for (const goal of goals) {
    const result = await goal.evaluate(context);
    if (result !== null) return result;
  }
  return null;
}
