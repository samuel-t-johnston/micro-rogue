import { effectHeal } from '../effect-types/effect-heal.js';
import { effectDamage } from '../effect-types/effect-damage.js';
import { effectSatiate } from '../effect-types/effect-satiate.js';

/**
 * @callback EffectHandler
 * @param {object} user - The entity applying the effect.
 * @param {object|null} target - The affected entity; null for self-targeted effects (e.g. drinking).
 * @param {object} params - Effect parameters (e.g. `{ amount }`).
 * @param {object} level
 * @param {object} registry
 * @returns {{applied: boolean, reaction?: string}} Whether the effect did anything (false when the
 *   subject lacks the component it needs) and optional flavor for the affected entity. Callers that
 *   don't care (drinking, melee) ignore it; throw uses it to decide what to log.
 */

// Effect type → handler registry. Add new effect types here.
const EFFECTS = {
  heal: effectHeal,
  damage: effectDamage,
  satiate: effectSatiate,
};

/**
 * Applies a registered effect by type to (user, target). Dispatches to the matching EffectHandler.
 * @returns {{applied: boolean, reaction?: string}} The handler's result (see EffectHandler).
 * @throws {Error} On an unknown effect type.
 */
export function applyEffect(effectType, user, target, params, level, registry) {
  const handler = EFFECTS[effectType];
  if (!handler) throw new Error(`Unknown effect type: ${effectType}`);
  return handler(user, target, params, level, registry);
}

/** Canonical effect type names. */
export const EffectTypes = Object.freeze({
  HEAL: 'heal',
  DAMAGE: 'damage',
  SATIATE: 'satiate',
});
