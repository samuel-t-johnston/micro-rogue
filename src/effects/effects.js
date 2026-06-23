import { effectHeal } from './effect-heal.js';
import { effectDamage } from './effect-damage.js';

/**
 * @callback EffectHandler
 * @param {object} user - The entity applying the effect.
 * @param {object|null} target - The affected entity; null for self-targeted effects (e.g. drinking).
 * @param {object} params - Effect parameters (e.g. `{ amount }`).
 * @param {object} level
 * @param {object} registry
 * @returns {void}
 */

// Effect type → handler registry. Add new effect types here.
const EFFECTS = {
  heal:   effectHeal,
  damage: effectDamage,
};

/**
 * Applies a registered effect by type to (user, target). Dispatches to the matching EffectHandler.
 * @throws {Error} On an unknown effect type.
 */
export function applyEffect(effectType, user, target, params, level, registry) {
  const handler = EFFECTS[effectType];
  if (!handler) throw new Error(`Unknown effect type: ${effectType}`);
  handler(user, target, params, level, registry);
}

/** Canonical effect type names. */
export const EffectTypes = Object.freeze({
  HEAL:   'heal',
  DAMAGE: 'damage',
});
