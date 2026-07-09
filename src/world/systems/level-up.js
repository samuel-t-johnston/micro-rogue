import { getScore, adjustScoreBase } from '../../attributes/attribute-access.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate } from '../../engine/log/text/log-text.js';

/**
 * @file Level-up: the turn-boundary watch that turns an entity's rising Level into permanent attribute
 * gains. Polled once per turn per entity carrying a `levelUp` component (see watchLevelUp); it diffs the
 * entity's derived Level against the watermark stored on the component and, for each level crossed,
 * allocates points across the attributes named in the component's spec.
 *
 * This module and the `levelUp` component are the whole of the level-up mechanic — a fork swapping how
 * leveling rewards work should only need to touch these two. It's also where future level-up bells and
 * whistles (sounds, effects, choose-your-own allocation) hang. Level derives from XP (data/
 * attribute-set.js), so nothing here reads the level curve directly. See docs/design/attribute-system.md.
 */

/**
 * Distributes `totalPoints` level-up points across the attributes named in `attributePercentages`,
 * returning a `{ attrName: count }` map. Points are placed one at a time; for each, the FIRST attribute
 * (in declared order) whose running allocation is still below its target share of the points placed so
 * far receives it. A zero-or-negative share never receives a point. Pure and deterministic — the whole
 * distribution for a level is a function of the point count, so a level-up event applies the delta
 * between the distribution at the old and new levels, and the round-robin phase carries across events.
 */
export function distributeLevelUpPoints(attributePercentages, totalPoints) {
  const names = Object.keys(attributePercentages);
  const alloc = {};
  for (const name of names) alloc[name] = 0;

  for (let placed = 1; placed <= totalPoints; placed++) {
    let chosen = names.find(
      (name) => attributePercentages[name] > 0 && alloc[name] < attributePercentages[name] * placed,
    );
    // Shares summing below 1 can leave every attribute at/above its target over enough points; fall
    // back to the first positive share so a point is never silently dropped.
    if (chosen === undefined) chosen = names.find((name) => attributePercentages[name] > 0);
    if (chosen !== undefined) alloc[chosen]++;
  }
  return alloc;
}

// Cumulative level-up points an entity has earned reaching `level` — one entity at level 1 has earned
// none, so its authored base stats stand alone (and a creature authored at level N is assumed to already
// carry the first N−1 levels' worth of growth). Keeps the phase math in one place.
const pointsForLevel = (level, perLevel) => (level - 1) * perLevel;

function announceLevelUp(entity, level) {
  if (!entity.components.has('playerControlled')) return; // keep off-screen creature growth out of the log
  gameLog.add({
    actor: entity.id,
    action: 'levelUp',
    display: `${subject(entity)} ${conjugate(entity, 'reach', 'reaches')} level ${level}!`,
  });
}

/**
 * Reconciles one entity's attributes with its current Level: a no-op unless the entity carries a
 * `dynamic` levelUp component whose Level has risen past the watermark it last allocated for. On a gain
 * it applies the point distribution between the old and new levels (capped at the spec's maxLevel),
 * advances the watermark, and announces the new level for the player.
 *
 * Poll-not-listen (docs/design/attribute-system.md): called at the entity's turn boundary, after any
 * XP earned this turn has landed, so the derived Level already reflects the kill that triggered it.
 */
export function watchLevelUp(entity) {
  const spec = entity.components.get('levelUp');
  if (!spec || !spec.dynamic) return;

  // A nullish cap means "no cap" — JSON has no Infinity, so an uncapped spec round-trips as null.
  const current = Math.min(getScore(entity, 'level'), spec.maxLevel ?? Infinity);
  if (current <= spec.lastLevel) return;

  const before = distributeLevelUpPoints(
    spec.attributePercentages,
    pointsForLevel(spec.lastLevel, spec.points),
  );
  const after = distributeLevelUpPoints(
    spec.attributePercentages,
    pointsForLevel(current, spec.points),
  );
  for (const name of Object.keys(spec.attributePercentages)) {
    const delta = (after[name] ?? 0) - (before[name] ?? 0);
    if (delta) adjustScoreBase(entity, name, delta);
  }

  spec.lastLevel = current;
  announceLevelUp(entity, current);
}
