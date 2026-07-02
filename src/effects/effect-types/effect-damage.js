import { handleDeath } from '../../combat/death.js';
import { hasAttribute, adjustPool } from '../../attributes/attribute-access.js';

/**
 * Reduces HP on the target via the hp pool (clamped at 0 by adjustPool). When HP reaches 0 the entity
 * dies — death is handled here so all damage sources (melee, hostile potions) route through one place.
 * Target defaults to user when omitted (e.g. drinking a hostile potion).
 * @returns {{applied: boolean, reaction?: string}} `applied` is false when the subject has no hp pool
 *   (so callers like throw can tell what actually landed); `reaction` is flavor for the affected one.
 */
export function effectDamage(user, target, params, level, registry) {
  const subject = target ?? user;
  if (!hasAttribute(subject, 'hp')) return { applied: false };
  const { current } = adjustPool(subject, 'hp', -(params.amount ?? 0));
  if (current <= 0) handleDeath(subject, level, registry);
  return { applied: true, reaction: 'looks hurt' };
}
