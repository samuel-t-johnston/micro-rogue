import { scentAt, gradientDir } from '../../world/scent.js';

/**
 * Creates the smell sense. Like hearing, it reports no entities and no visible tiles — it surfaces
 * *scents* into the SenseResult's `smells` channel (merged into context.perception.smells). For each
 * scent profile whose intensity at the smeller's tile clears the smeller's threshold, it emits a
 * percept `{ profile, direction, intensity }` (direction = gradient toward the source, or null at a peak).
 *
 * Acuity is the `smell` component's `threshold` — a keen nose has a LOW threshold (senses faint
 * scent), a missing component means no smell at all. The sense reports every above-threshold profile
 * and goals do the filtering (trackers → hostile profiles; the player → non-self, loggable ones).
 */
export function createSmellSense() {
  return function smell(entity, level, turnCount) {
    const smells = [];
    const pos = entity.components.get('position');
    const acuity = entity.components.get('smell');

    if (pos && acuity && level.scent) {
      for (const profile of level.scent.keys()) {
        const intensity = scentAt(level, profile, pos.x, pos.y);
        if (intensity <= 0 || intensity < acuity.threshold) continue;
        smells.push({
          profile,
          direction: gradientDir(level, profile, pos.x, pos.y),
          intensity,
          turnObserved: turnCount,
        });
      }
    }

    return { entities: [], visibleTiles: new Set(), smells };
  };
}
