// Restores HP on the target. Clamps at health.max so callers can't overheal.
// target defaults to user when omitted (e.g. drinking a potion).
export function effectHeal(user, target, params, _level, _registry) {
  const subject = target ?? user;
  const health = subject.components.get('health');
  if (!health) return;
  health.current = Math.min(health.max, health.current + (params.amount ?? 0));
}
