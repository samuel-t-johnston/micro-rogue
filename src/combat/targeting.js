/**
 * @file Targeting: whether an actor at one tile can land an attack on another, given its weapon reach.
 * One definition shared by the player's tile-action resolver (resolve-tile-actions.js) and the NPC
 * attack goal (attack-in-range.js), so "can I hit it" and "where does a shot land" can never disagree —
 * both run the same flight trace. See docs/design/ranged-weapons.md.
 */
import { chebyshevDistance } from '../world/map/geometry.js';
import { traceFlight } from '../actions/core/projectile-flight.js';

/**
 * Whether `from` can attack `to` with reach `capability` ({ range, meleeRange }). A target within
 * meleeRange is always reachable (you're on top of it — no line check); beyond that, out to range, it
 * needs a clear straight line (the flight trace reaches the target tile only when nothing blocks the
 * way short of it). Distance is Chebyshev. Returns false for the actor's own tile and anything past
 * range.
 * @param {object} level
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {{range: number, meleeRange: number}} capability
 */
export function isAttackable(level, from, to, { range, meleeRange }) {
  const distance = chebyshevDistance(from, to);
  if (distance === 0 || distance > range) return false;
  if (distance <= meleeRange) return true;
  const { impact } = traceFlight(level, from.x, from.y, to.x, to.y);
  return impact.x === to.x && impact.y === to.y;
}
