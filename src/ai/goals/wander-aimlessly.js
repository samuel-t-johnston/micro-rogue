import { rng } from '../../engine/rng.js';
import { passableNeighbors } from '../../world/geometry.js';

// Minimal NPC goal: step to a random passable adjacent tile each turn.
// If no adjacent tile is passable, wait (a consumed, no-op turn) rather than
// forfeiting via a free action — returning a free action here would re-run this
// goal in the same loop iteration and spin forever for a boxed-in creature.
export const wanderAimlessly = {
  evaluate(context) {
    const { selfState, level } = context;

    const passable = passableNeighbors(selfState.position, level);
    if (passable.length === 0) return { action: { type: 'wait' } };

    const tile = rng.pick(passable);
    return { action: { type: 'move', x: tile.x, y: tile.y } };
  },
};
