import { effectHeal } from './effect-heal.js';
import { effectDamage } from './effect-damage.js';

// Effect type → handler registry. New effect types are added here.
// Handlers share the signature: (user, target, params, level, registry) → void.
// target may be null for self-targeted effects (e.g. drinking).
const EFFECTS = {
  heal:   effectHeal,
  damage: effectDamage,
};

export function applyEffect(effectType, user, target, params, level, registry) {
  const handler = EFFECTS[effectType];
  if (!handler) throw new Error(`Unknown effect type: ${effectType}`);
  handler(user, target, params, level, registry);
}

export const EffectTypes = Object.freeze({
  HEAL:   'heal',
  DAMAGE: 'damage',
});
