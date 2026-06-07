import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance } from '../../world/geometry.js';
import { findPathToAdjacent } from '../../world/pathfinding.js';

// Moves toward the nearest hostile actor. Steps one tile along the shortest path to a
// tile adjacent to the target (the target's own tile blocks movement, so we approach it).
// Returns null when already adjacent or when no hostile is perceived / no route exists.
export const chaseOthers = {
  evaluate(context) {
    const { selfState, perception, level } = context;

    const hostiles = perception.entities.filter(o =>
      o.tags.isActor && areHostile(selfState.factions, o.factions));
    if (hostiles.length === 0) return null;

    let target = hostiles[0];
    let targetDistance = chebyshevDistance(selfState.position, target.position);
    for (const hostile of hostiles) {
      const distance = chebyshevDistance(selfState.position, hostile.position);
      if (distance < targetDistance) {
        target = hostile;
        targetDistance = distance;
      }
    }

    if (targetDistance === 1) return null; // adjacent — let attack-adjacent fire

    const path = findPathToAdjacent(selfState.position, target.position, level);
    if (!path || path.length === 0) return null;

    return { action: { type: 'move', x: path[0].x, y: path[0].y } };
  },
};
