/**
 * @file Syncs an entity's derived Speed score into its `turnTaker.speed` — the value the turn manager
 * reads to drive turn order. The turn module is deliberately ignorant of attributes (so it stays
 * swappable), so rather than teach it to resolve scores, we poll each entity at its turn boundary
 * (game-scene's onTurnStart) and seed the same value at construction, writing the resolved `spd` back
 * into the component. This is the poll-not-listen pattern the attribute design mandates. Speed is
 * clamped to a small floor so a low base or a debuff can never stall an entity out of the queue
 * entirely. See docs/design/attribute-system.md §5 and docs/design/turn-order.md.
 */
import { getScore } from './attribute-access.js';

/** Floor for a derived turn speed: a slowed entity still acts eventually, never fully frozen. */
export const MIN_SPEED = 0.1;

/**
 * Recomputes `turnTaker.speed` from the entity's `spd` score (base + equipment + DEX), clamped to
 * MIN_SPEED. No-op for an entity lacking an `attributes` component (its turnTaker keeps the literal it
 * was constructed with) or a `turnTaker` (nothing to drive) — the correct dividing line, since a
 * timed non-creature turn-taker has no attributes and should keep its fixed speed.
 */
export function syncSpeed(entity) {
  const turnTaker = entity.components.get('turnTaker');
  if (!turnTaker || !entity.components.has('attributes')) return;
  turnTaker.speed = Math.max(MIN_SPEED, getScore(entity, 'spd'));
}
