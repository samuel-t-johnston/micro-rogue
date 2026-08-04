/**
 * @file Search: the shared core that finds and reveals nearby secrets (secret doors today). One
 * function serves both the active search action (consumes a turn) and the passive per-turn upkeep
 * sweep, so their odds can't drift. Effectiveness scales with the searcher's INT and falls off with
 * distance; passive halves it again. See docs/design/secret-doors-and-search.md.
 */
import { chebyshevDistance } from '../map/geometry.js';
import { getScore } from '../../attributes/attribute-access.js';
import { revealSecret } from '../entities/furniture.js';
import { rng } from '../../engine/core/rng.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * The chance (0..1) that a single search reveals a secret at `distance` from the searcher. Base
 * effectiveness is `5% + 5%·INT`, capped at 95%; it applies at full strength to the 8 adjacent tiles
 * (distance 1) and at half to the 16 tiles at distance 2. Passive search halves the result again, so
 * it is half as likely to find an adjacent secret and a quarter as likely at distance 2. Distances
 * outside 1..2 yield 0.
 */
export function searchChance(intScore, distance, passive) {
  const base = clamp(0.05 + 0.05 * intScore, 0, 0.95);
  const distanceFactor = distance === 1 ? 1 : distance === 2 ? 0.5 : 0;
  return base * distanceFactor * (passive ? 0.5 : 1);
}

/**
 * Rolls to reveal each secret within Chebyshev distance 2 of `actor`, on this level. One independent
 * roll per candidate; on success the secret is revealed (see revealSecret). Player-agnostic and does
 * no logging — the caller (the active action or the passive upkeep step) owns any player-facing
 * feedback. `rng` is injectable for tests; it defaults to the saved, seeded `search` stream so passive
 * sweeps advance deterministically and survive save/load.
 * @returns {object[]} The secrets revealed by this call (empty if none).
 */
export function performSearch(actor, level, registry, { passive = false, rng: roll } = {}) {
  const stream = roll ?? rng.stream('search');
  const pos = actor.components.get('position');
  const intScore = getScore(actor, 'int');
  const revealed = [];
  for (const entity of level.entities) {
    if (!entity.components.has('secret')) continue;
    const epos = entity.components.get('position');
    const distance = chebyshevDistance(pos, epos);
    if (distance < 1 || distance > 2) continue;
    if (stream.random() < searchChance(intScore, distance, passive)) {
      revealSecret(entity, level, registry);
      revealed.push(entity);
    }
  }
  return revealed;
}
