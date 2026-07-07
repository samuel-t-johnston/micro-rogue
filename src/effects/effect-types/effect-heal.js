import { hasPool, adjustPool } from '../../attributes/attribute-access.js';

/**
 * Restores HP on the target via the hp pool (clamped at max by adjustPool, so callers can't overheal).
 * Target defaults to user when omitted (e.g. drinking a potion).
 * @returns {{applied: boolean, reaction?: string}} `applied` is false when the subject has no hp pool;
 *   `reaction` is flavor for the affected one (read by throw to compose its log).
 */
export function effectHeal(user, target, params, _level, _registry) {
  const subject = target ?? user;
  if (!hasPool(subject, 'hp')) return { applied: false };
  adjustPool(subject, 'hp', params.amount ?? 0);
  return { applied: true, reaction: 'seems healthier' };
}
