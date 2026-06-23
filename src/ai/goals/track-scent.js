import { areHostile } from '../../combat/factions.js';
import { DIRECTION_STEPS } from '../../world/geometry.js';

/**
 * NPC goal: follow the strongest *hostile* scent toward its source. Reads perception.smells, keeps
 * profiles hostile to this creature (a scent profile is a faction tag, so areHostile applies), and
 * steps toward the strongest one's gradient direction. The scent field is the persistence — it
 * re-homes every turn — so no memory is needed. Sits below chase/attack: once the quarry comes into
 * view those higher goals take over. Returns null with no hostile scent, no gradient, or a blocked
 * step. Following the strongest scent each turn means it can switch targets — a committed,
 * single-minded tracker is a deferred refinement (see scent-and-smell.md).
 */
export const trackScent = {
  evaluate(context) {
    const { selfState, perception, level } = context;

    const hostile = (perception.smells ?? []).filter(s =>
      s.direction && areHostile(selfState.factions, [s.profile]));
    if (hostile.length === 0) return null;

    let target = hostile[0];
    for (const s of hostile) if (s.intensity > target.intensity) target = s;

    const [dx, dy] = DIRECTION_STEPS[target.direction];
    const nx = selfState.position.x + dx;
    const ny = selfState.position.y + dy;
    if (!level.isPassable(nx, ny)) return null;

    return { action: { type: 'move', x: nx, y: ny } };
  },
};
