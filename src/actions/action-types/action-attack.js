import { applyEffect } from '../../effects/effects.js';
import { getAttribute, Attributes } from '../../combat/attributes.js';

// Deals the actor's attack damage to the target entity. The amount comes from the
// attribute resolver (unarmed base + worn-weapon modifiers); damage is applied through
// the shared 'damage' effect, which also handles death when HP reaches 0.
// Returns false — attacking always consumes the turn (including a swing at a target that
// died before resolution).
export function executeAttack(actor, action, level, registry) {
  const target = registry.getEntity(action.targetEntityId);
  if (!target?.components.has('health')) return false;

  const amount = getAttribute(actor, Attributes.ATTACK_DAMAGE);
  applyEffect('damage', actor, target, { amount }, level, registry);
  return false;
}
