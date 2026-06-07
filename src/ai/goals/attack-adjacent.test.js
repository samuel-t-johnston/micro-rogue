import { describe, it, expect } from 'vitest';
import { attackAdjacent } from './attack-adjacent.js';

// Observation builder matching the sense output shape.
function obs(entityId, x, y, factions, { isActor = true } = {}) {
  return { entityId, position: { x, y }, factions, tags: { isActor } };
}

function ctx(entities, { x = 5, y = 5, factions = ['goblins'] } = {}) {
  return { selfState: { position: { x, y }, factions }, perception: { entities } };
}

describe('attackAdjacent', () => {
  it('attacks a hostile actor in an adjacent tile', () => {
    const result = attackAdjacent.evaluate(ctx([obs(7, 6, 5, ['player'])]));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 7 } });
  });

  it('attacks diagonally adjacent hostiles', () => {
    const result = attackAdjacent.evaluate(ctx([obs(7, 6, 6, ['player'])]));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 7 } });
  });

  it('ignores a same-faction neighbor', () => {
    expect(attackAdjacent.evaluate(ctx([obs(7, 6, 5, ['goblins'])]))).toBeNull();
  });

  it('ignores non-actor neighbors (e.g. a dropped item)', () => {
    expect(attackAdjacent.evaluate(ctx([obs(7, 6, 5, [], { isActor: false })]))).toBeNull();
  });

  it('ignores hostiles that are not adjacent', () => {
    expect(attackAdjacent.evaluate(ctx([obs(7, 8, 5, ['player'])]))).toBeNull();
  });
});
