/**
 * @file Ranged accuracy — the chance a fired or thrown projectile misses its target, and the roll that
 * decides it. Melee never misses (it doesn't route here); a strike is "ranged" for accuracy exactly
 * when it spends ammunition (bow shot, thrown javelin), the same discriminator the damage formula uses.
 * `missChance` is a pure function of the shooter and range so it can be unit-tested and displayed; the
 * roll goes through the shared gameplay `rng` like breakChance. See docs/design/ranged-weapons.md.
 */
import { getScore } from '../attributes/attribute-access.js';
import { rng } from '../engine/core/rng.js';

/** Base miss chance before range and skill. */
export const MISS_BASE = 0.25;
/** Miss chance rises this much per tile of distance to the target. */
export const MISS_PER_DISTANCE = 0.01;
/** Each point of (capped) DEX shaves this much off the miss chance. */
export const MISS_PER_DEX = 0.01;
/** DEX beyond this doesn't further improve accuracy — keeps a floor so no shot is ever automatic. */
export const DEX_CAP = 20;
/** Even a hopeless-looking shot keeps this hit chance; a point-blank expert never quite reaches 100%. */
export const MISS_MAX = 0.95;

/**
 * Probability in [0, MISS_MAX] that a ranged strike from `actor` at chebyshev `distance` misses:
 * `MISS_BASE + MISS_PER_DISTANCE·distance − MISS_PER_DEX·min(DEX, DEX_CAP)`. DEX is capped so a maxed
 * archer sits at ~95% to hit at close range, leaving room for future accuracy bonuses to matter.
 */
export function missChance(actor, distance) {
  const dex = Math.min(getScore(actor, 'dex'), DEX_CAP);
  const chance = MISS_BASE + MISS_PER_DISTANCE * distance - MISS_PER_DEX * dex;
  return Math.max(0, Math.min(MISS_MAX, chance));
}

/** Rolls the shared gameplay RNG against missChance: true if this ranged strike goes wide. */
export function rollsMiss(actor, distance) {
  return rng.random() < missChance(actor, distance);
}
