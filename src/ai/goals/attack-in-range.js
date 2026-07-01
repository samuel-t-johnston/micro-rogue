import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance } from '../../world/map/geometry.js';
import { isAttackable } from '../../combat/targeting.js';

/**
 * NPC goal: attacks the nearest hostile actor within weapon reach. Reach comes from the creature's own
 * equipped weapon (selfState.attackCapability), so this one goal covers melee (range 1 → adjacent only)
 * and reach/ranged (a clear line out to the weapon's range) with no branching — executeAttack picks the
 * mode from the distance. Among in-reach, clear-line hostiles it targets the nearest; it falls through
 * (null) when none is attackable, leaving a lower chase goal to close the gap.
 */
export const attackInRange = {
  evaluate(context) {
    const { selfState, perception, level } = context;
    const capability = selfState.attackCapability;

    let target = null;
    let best = Infinity;
    for (const other of perception.entities) {
      if (!other.tags.isActor || !areHostile(selfState.factions, other.factions)) continue;
      const distance = chebyshevDistance(selfState.position, other.position);
      if (distance >= best) continue;
      if (!isAttackable(level, selfState.position, other.position, capability)) continue;
      target = other;
      best = distance;
    }

    if (!target) return null;
    return { action: { type: 'attack', targetEntityId: target.entityId } };
  },
};
