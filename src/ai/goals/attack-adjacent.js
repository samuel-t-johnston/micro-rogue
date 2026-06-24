import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance } from '../../world/map/geometry.js';

/**
 * NPC goal: attacks a hostile actor in an adjacent tile. Hostile = an actor (creature) that shares
 * no faction with us. Among adjacent hostiles, targets the first one found.
 */
export const attackAdjacent = {
  evaluate(context) {
    const { selfState, perception } = context;

    const target = perception.entities.find(
      (o) =>
        o.tags.isActor &&
        areHostile(selfState.factions, o.factions) &&
        chebyshevDistance(selfState.position, o.position) === 1,
    );

    if (!target) return null;
    return { action: { type: 'attack', targetEntityId: target.entityId } };
  },
};
