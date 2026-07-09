/**
 * @file Scale-creatures stage: boots already-placed creatures to a per-floor level. It runs after the
 * creatures exist on the level and, for each one whose `entityTypeId` is named in the stage's `levels`
 * map, raises it to that level — setting its `xp` so its derived Level (and thus the XP it's worth when
 * killed) matches, and applying its level-up attribute growth via the shared allocator.
 *
 * Only `levelUp.dynamic === false` creatures are scaled: dynamic growers (the player) level themselves
 * from XP at run time and must never be pre-scaled by map generation. A creature named in the config but
 * not present on the floor is simply skipped, and a creature present but not named is left untouched —
 * so one config can serve any subset of a floor's population. See docs/howto/tuning-level-up-growth.md
 * and the levelUp specs authored in src/world/entities/creatures.js.
 */
import { xpForLevel } from '../../../../data/attribute-set.js';
import { getAccumulator, addToAccumulator } from '../../../attributes/attribute-access.js';
import { applyLevelUps } from '../../systems/level-up.js';

/** Runs the scale-creatures stage (see the file overview). `stageConfig.levels` maps entityTypeId → target level. */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const targets = stageConfig.levels ?? {};

  for (const entity of registry.getEntitiesWith('levelUp')) {
    const spec = entity.components.get('levelUp');
    if (spec.dynamic) continue; // dynamic growers level themselves from XP; never pre-scale them

    const requested = targets[entity.components.get('entityTypeId')];
    if (requested == null) continue; // not named in this floor's config

    const target = Math.min(requested, spec.maxLevel ?? Infinity);
    // Set xp to the target level's threshold so the creature reads as that level (display + kill reward);
    // xp only ever climbs, so a creature already at/above the target keeps its higher xp.
    const targetXp = xpForLevel(target);
    const currentXp = getAccumulator(entity, 'xp');
    if (targetXp > currentXp) addToAccumulator(entity, 'xp', targetXp - currentXp);

    applyLevelUps(entity, spec, target); // grow its attributes for the gained levels
  }
}
