import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance } from '../../world/map/geometry.js';
import { findPathToAdjacent } from '../../world/map/pathfinding.js';

/**
 * NPC goal: moves toward the nearest *reachable* hostile actor. Steps one tile along the shortest
 * path to a tile adjacent to the target (the target's own tile blocks movement, so we approach it).
 * Hostiles are considered nearest-first, and a nearer foe that's walled off doesn't stop the creature
 * pursuing a reachable farther one — mirroring how attack-in-range iterates its candidates rather than
 * committing to a single nearest. Returns null when already adjacent, or when no hostile is perceived
 * / none is reachable.
 */
export const chaseOthers = {
  evaluate(context) {
    const { selfState, perception, level } = context;

    const hostiles = perception.entities
      .filter((o) => o.tags.isActor && areHostile(selfState.factions, o.factions))
      .map((o) => ({ hostile: o, distance: chebyshevDistance(selfState.position, o.position) }))
      .sort((a, b) => a.distance - b.distance);
    if (hostiles.length === 0) return null;

    if (hostiles[0].distance === 1) return null; // adjacent to the nearest — let attack-in-range fire

    // Pursue the nearest hostile we can actually path to. One pathfind per candidate, but bounded by
    // the perceived-hostile count and short-circuited at the first reachable foe (usually the nearest).
    for (const { hostile } of hostiles) {
      const path = findPathToAdjacent(selfState.position, hostile.position, level);
      if (path && path.length > 0) {
        return { action: { type: 'move', x: path[0].x, y: path[0].y } };
      }
    }
    return null;
  },
};
