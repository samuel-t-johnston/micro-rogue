import { hasPool, adjustPool } from '../../attributes/attribute-access.js';

/**
 * Restores hunger on the target via the hunger pool (clamped at max by adjustPool, so eating past full
 * is wasted). Target defaults to user when omitted (the eating case). Mirrors effectHeal — hunger and
 * HP are both pools, differing only in which one they fill.
 * @returns {{applied: boolean, reaction?: string}} `applied` is false when the subject has no hunger
 *   pool; `reaction` is flavor for the affected one (read by throw to compose its log).
 */
export function effectSatiate(user, target, params, _level, _registry) {
  const subject = target ?? user;
  if (!hasPool(subject, 'hunger')) return { applied: false };
  adjustPool(subject, 'hunger', params.amount ?? 0);
  return { applied: true, reaction: 'looks nourished' };
}
