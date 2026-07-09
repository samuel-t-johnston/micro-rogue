import { getScore, adjustScoreBase } from '../../attributes/attribute-access.js';
import { getDefinition } from '../../attributes/attribute-registry.js';
import { gameLog } from '../../engine/log/game-log.js';
import { subject, conjugate } from '../../engine/log/text/log-text.js';
import { vignette } from '../../render/vignette.js';

// The player's level-up flourish: a single slow gold swell around the screen edge (see vignette.js).
const LEVEL_UP_VIGNETTE = { color: '#ffcf40', pulses: 1, pulseLength: 3000 };

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

// "+1 STR, +1 CON" from a { attr: delta } map, using each attribute's display label; "" if no gains.
function formatGains(gains) {
  return Object.entries(gains)
    .map(([name, delta]) => `+${delta} ${getDefinition(name).shortLabel}`)
    .join(', ');
}

function announceLevelUp(entity, level, gains) {
  if (!entity.components.has('playerControlled')) return; // creatures grow silently; the player gets the show
  vignette.trigger(LEVEL_UP_VIGNETTE);
  const deltas = formatGains(gains);
  const reach = `${subject(entity)} ${conjugate(entity, 'reach', 'reaches')} level ${level}!`;
  gameLog.add({
    actor: entity.id,
    action: 'levelUp',
    display: deltas ? `${reach} ${deltas}` : reach,
  });
}

/**
 * Grows an entity's attributes from its watermark `lastLevel` up to `toLevel`, applying the point
 * distribution earned over those levels and advancing the watermark. Returns `{ levels, gains }` — the
 * number of levels gained (0 if `toLevel` isn't above the watermark) and a `{ attr: delta }` map of the
 * increases (for the level-up log). The shared core of both mid-game growth (`watchLevelUp`) and
 * generation-time scaling (the scaleCreatures stage) — it ignores `dynamic` and the level cap, leaving
 * those policy checks to the caller.
 */
export function applyLevelUps(entity, spec, toLevel) {
  const from = spec.lastLevel;
  if (toLevel <= from) return { levels: 0, gains: {} };

  const before = distributeLevelUpPoints(
    spec.attributePercentages,
    pointsForLevel(from, spec.points),
  );
  const after = distributeLevelUpPoints(
    spec.attributePercentages,
    pointsForLevel(toLevel, spec.points),
  );
  const gains = {};
  for (const name of Object.keys(spec.attributePercentages)) {
    const delta = (after[name] ?? 0) - (before[name] ?? 0);
    if (delta) {
      adjustScoreBase(entity, name, delta);
      gains[name] = delta;
    }
  }

  spec.lastLevel = toLevel;
  return { levels: toLevel - from, gains };
}

/**
 * Reconciles a `dynamic` entity's attributes with its current derived Level: a no-op unless the entity
 * carries a `dynamic` levelUp component whose Level has risen past the watermark it last allocated for.
 * On a gain it grows the attributes (capped at the spec's maxLevel) and announces the new level.
 *
 * Poll-not-listen (docs/design/attribute-system.md): called at the entity's turn boundary, after any
 * XP earned this turn has landed, so the derived Level already reflects the kill that triggered it.
 */
export function watchLevelUp(entity) {
  const spec = entity.components.get('levelUp');
  if (!spec || !spec.dynamic) return;

  // A nullish cap means "no cap" — JSON has no Infinity, so an uncapped spec round-trips as null.
  const current = Math.min(getScore(entity, 'level'), spec.maxLevel ?? Infinity);
  const { levels, gains } = applyLevelUps(entity, spec, current);
  if (levels > 0) announceLevelUp(entity, current, gains);
}
