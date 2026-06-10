import { applyEffect } from '../../effects/effects.js';
import { getAttribute, Attributes } from '../../combat/attributes.js';
import { gameLog } from '../../engine/game-log.js';
import { subject, object, conjugate } from '../../engine/log-text.js';

// Deals the actor's attack damage to the target entity. The amount comes from the
// attribute resolver (unarmed base + worn-weapon modifiers); damage is applied through
// the shared 'damage' effect, which also handles death when HP reaches 0.
// Returns false — attacking always consumes the turn (including a swing at a target that
// died before resolution).
export function executeAttack(actor, action, level, registry) {
  const target = registry.getEntity(action.targetEntityId);
  if (!target?.components.has('health')) return false;

  const amount = getAttribute(actor, Attributes.ATTACK_DAMAGE);

  // Log the hit before applying the effect: the damage effect may route the target
  // through death (which clears its components), and we still want the target's name
  // and pronoun here. The resulting death line is logged separately by handleDeath.
  gameLog.add({
    actor: actor.id,
    action: 'attack',
    target: target.id,
    damage: amount,
    display: `${subject(actor)} ${conjugate(actor, 'hit', 'hits')} ${object(target)} for ${amount} damage.`,
  });

  applyEffect('damage', actor, target, { amount }, level, registry);
  return false;
}
