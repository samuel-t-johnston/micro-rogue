/**
 * @file Kill reward: credits a killer with experience for defeating a creature. Called from the death
 * chokepoint (death.js) while the victim is still intact, so its level can be read before teardown.
 * XP scales with the victim's level; the level itself derives from the victim's own xp (see
 * data/attribute-set.js), so a tougher, higher-level foe is worth more. Deliberately simple until the
 * progression-tuning pass — see docs/design/attribute-system.md.
 */
import { getScore, addToAccumulator } from '../attributes/attribute-access.js';
import { gameLog } from '../engine/log/game-log.js';
import { subject, conjugate } from '../engine/log/text/log-text.js';

// Placeholder tuning: XP awarded per level of the defeated creature. A whole topic (curve, payouts,
// level-up rewards) is deferred to the progression pass; this is the minimal "xp accrues on kills" cut.
const XP_PER_VICTIM_LEVEL = 5;

/**
 * Credits `killer` with experience for defeating `victim`. A no-op unless the victim is a creature (only
 * creatures are worth XP) and there is a distinct killer able to hold xp (has an attributes component,
 * so the accumulator has somewhere to land). All creatures earn — they already fight each other via
 * factions — but only the player's gain is logged, to keep off-screen brawls out of the message log.
 */
export function awardKillXp(victim, killer) {
  if (!killer || killer === victim) return;
  if (!victim.components.has('creature')) return;
  if (!killer.components.has('attributes')) return;

  const reward = XP_PER_VICTIM_LEVEL * getScore(victim, 'level');
  if (reward <= 0) return;
  addToAccumulator(killer, 'xp', reward);

  if (killer.components.has('playerControlled')) {
    gameLog.add({
      actor: killer.id,
      action: 'xp',
      display: `${subject(killer)} ${conjugate(killer, 'gain', 'gains')} ${reward} experience.`,
    });
  }
}
