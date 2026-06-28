/**
 * Restores HP on the target, clamping at health.max so callers can't overheal. Target defaults to
 * user when omitted (e.g. drinking a potion).
 * @returns {{applied: boolean, reaction?: string}} `applied` is false when the subject has no health;
 *   `reaction` is flavor for the affected one (read by throw to compose its log).
 */
export function effectHeal(user, target, params, _level, _registry) {
  const subject = target ?? user;
  const health = subject.components.get('health');
  if (!health) return { applied: false };
  health.current = Math.min(health.max, health.current + (params.amount ?? 0));
  return { applied: true, reaction: 'seems healthier' };
}
