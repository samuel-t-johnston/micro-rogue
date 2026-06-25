import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance, passableNeighbors } from '../../world/map/geometry.js';

// Distance from `pos` to the nearest hostile.
function nearestHostileDistance(pos, hostiles) {
  return Math.min(...hostiles.map((h) => chebyshevDistance(pos, h.position)));
}

/**
 * NPC goal: moves away from hostile actors — steps to the adjacent tile that maximizes distance to
 * the nearest hostile. Will take an equally-distant tile when none is farther (e.g. sliding along a
 * wall) so it keeps moving and may find a gap; only waits when every neighbor is strictly closer —
 * truly cornered with a hostile closing in on the diagonal. Returns null when no hostile is perceived.
 */
export const fleeFromOthers = {
  evaluate(context) {
    const { selfState, perception, level } = context;

    const hostiles = perception.entities.filter(
      (o) => o.tags.isActor && areHostile(selfState.factions, o.factions),
    );
    if (hostiles.length === 0) return null;

    const currentDistance = nearestHostileDistance(selfState.position, hostiles);

    let best = null;
    let bestDistance = -Infinity;
    for (const tile of passableNeighbors(selfState.position, level)) {
      const distance = nearestHostileDistance(tile, hostiles);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = tile;
      }
    }

    // Move if we can hold or improve our distance; wait only when every escape closes the gap.
    if (!best || bestDistance < currentDistance) return { action: { type: 'wait' } };
    return { action: { type: 'move', x: best.x, y: best.y } };
  },
};
