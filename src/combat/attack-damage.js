/**
 * @file The single source of the attack-damage formula. Kept out of the attribute resolvers because
 * the melee/ranged split is an *action-time* fact (which strike is being made), not entity state — the
 * `attack` Score itself is mode-independent (unarmed/innate base + weapon & equipment modifiers). This
 * helper layers the ability scaling on top of it. See docs/design/attribute-system.md.
 */
import { getScore } from '../attributes/attribute-access.js';

/**
 * Final damage for a single strike: the `attack` score plus an ability bonus of half the governing
 * ability score — DEX for a ranged strike, STR for melee — rounded down and clamped to a minimum of 1
 * (an attack never deals 0).
 *
 * `isRanged` is the attack *mode*. Callers derive it from whether the strike consumes ammunition (a bow
 * shot or a thrown javelin): that — not raw distance — is what makes a strike ranged, which is why a
 * spear's reach and a javelin's point-blank stab both resolve as melee (STR).
 */
export function resolveAttackDamage(actor, { isRanged }) {
  const stat = isRanged ? 'dex' : 'str';
  return Math.max(1, Math.floor(getScore(actor, 'attack') + getScore(actor, stat) / 2));
}
