import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance, passableNeighbors } from '../../world/geometry.js';

// Distance from `pos` to the nearest hostile.
function nearestHostileDistance(pos, hostiles) {
  return Math.min(...hostiles.map(h => chebyshevDistance(pos, h.position)));
}

/**
 * NPC goal: moves away from hostile actors — steps to the adjacent tile that maximizes distance to
 * the nearest hostile. If no neighbor improves on the current distance (cornered), waits. Returns
 * null when no hostile is perceived.
 */
export const fleeFromOthers = {
  evaluate(context) {
    const { selfState, perception, level } = context;

    const hostiles = perception.entities.filter(o =>
      o.tags.isActor && areHostile(selfState.factions, o.factions));
    if (hostiles.length === 0) return null;

    const currentDistance = nearestHostileDistance(selfState.position, hostiles);

    let best = null;
    let bestDistance = currentDistance;
    for (const tile of passableNeighbors(selfState.position, level)) {
      const distance = nearestHostileDistance(tile, hostiles);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = tile;
      }
    }

    if (!best) return { action: { type: 'wait' } };
    return { action: { type: 'move', x: best.x, y: best.y } };
  },
};
