import { handleDeath } from '../../combat/death.js';

/**
 * Reduces HP on the target, clamping at 0. When HP reaches 0 the entity dies — death is handled here
 * so all damage sources (melee, hostile potions) route through one place. Target defaults to user
 * when omitted (e.g. drinking a hostile potion).
 * @returns {{applied: boolean, reaction?: string}} `applied` is false when the subject has no health
 *   (so callers like throw can tell what actually landed); `reaction` is flavor for the affected one.
 */
export function effectDamage(user, target, params, level, registry) {
  const subject = target ?? user;
  const health = subject.components.get('health');
  if (!health) return { applied: false };
  health.current = Math.max(0, health.current - (params.amount ?? 0));
  if (health.current <= 0) handleDeath(subject, level, registry);
  return { applied: true, reaction: 'looks hurt' };
}
