import { rng } from '../../engine/rng.js';

// 8-directional offsets, matching pathfinding and the player's diagonal adjacency.
const ADJACENT = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Minimal NPC goal: step to a random passable adjacent tile each turn.
// If no adjacent tile is passable, wait (a consumed, no-op turn) rather than
// forfeiting via a free action — returning a free action here would re-run this
// goal in the same loop iteration and spin forever for a boxed-in creature.
export const wanderAimlessly = {
  evaluate(context) {
    const { selfState, level } = context;
    const { x, y } = selfState.position;

    const passable = ADJACENT
      .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
      .filter(tile => level.isPassable(tile.x, tile.y));

    if (passable.length === 0) return { action: { type: 'wait' } };

    const tile = rng.pick(passable);
    return { action: { type: 'move', x: tile.x, y: tile.y } };
  },
};
