import { gameLog } from '../../engine/log/game-log.js';
import { performSearch } from '../../world/systems/search.js';

/**
 * Executes an active search: one full-strength sweep of the searcher's surroundings for secrets,
 * consuming the turn (see docs/design/secret-doors-and-search.md). The reveal logic lives in
 * performSearch (shared with the passive per-turn sweep); this handler owns only the player-facing
 * feedback. `rng` is injectable for tests; production omits it so performSearch uses the seeded stream.
 * @returns {boolean} Always `false` — searching always spends the turn, hit or miss.
 */
export function executeSearch(actor, action, level, registry, { rng } = {}) {
  const revealed = performSearch(actor, level, registry, { passive: false, rng });

  // NOTE: the discovery wording hard-codes "door" — every secret is a door today. The passive sweep
  // (game-scene.js) carries a parallel copy with a different verb ("notice"). When a second secret
  // type lands (a hidden chest?), both must move to a shared, per-entity noun. See
  // docs/design/secret-doors-and-search.md §5.4.
  if (revealed.length > 0) {
    gameLog.add({
      actor: actor.id,
      action: 'search',
      found: revealed.length,
      display: revealed.length === 1 ? 'You discover a hidden door!' : 'You discover hidden doors!',
    });
  } else {
    gameLog.add({
      actor: actor.id,
      action: 'search',
      display: 'You search but find nothing.',
    });
  }

  return false;
}
