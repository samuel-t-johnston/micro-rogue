import { describe, it, expect } from 'vitest';
import { attackInRange } from './attack-in-range.js';
import { createLevel } from '../../world/map/level.js';

function openLevel(w = 11, h = 11) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) =>
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 'wall' : 'floor',
    ),
  );
  return level;
}

function obs(entityId, x, y, factions, { isActor = true } = {}) {
  return { entityId, position: { x, y }, factions, tags: { isActor } };
}

// Default capability is melee (range 1, meleeRange 1) so the ported melee cases match attack-adjacent.
function ctx(entities, level, { x = 5, y = 5, factions = ['goblins'], capability } = {}) {
  return {
    selfState: {
      position: { x, y },
      factions,
      attackCapability: capability ?? { range: 1, meleeRange: 1 },
    },
    perception: { entities },
    level,
  };
}

const bow = { range: 15, meleeRange: 0 };

describe('attackInRange — melee reach (range 1)', () => {
  it('attacks a hostile actor in an adjacent tile', () => {
    const result = attackInRange.evaluate(ctx([obs(7, 6, 5, ['player'])], openLevel()));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 7 } });
  });

  it('attacks diagonally adjacent hostiles', () => {
    const result = attackInRange.evaluate(ctx([obs(7, 6, 6, ['player'])], openLevel()));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 7 } });
  });

  it('ignores a same-faction neighbor', () => {
    expect(attackInRange.evaluate(ctx([obs(7, 6, 5, ['goblins'])], openLevel()))).toBeNull();
  });

  it('ignores non-actor neighbors (e.g. a dropped item)', () => {
    const entities = [obs(7, 6, 5, [], { isActor: false })];
    expect(attackInRange.evaluate(ctx(entities, openLevel()))).toBeNull();
  });

  it('ignores hostiles beyond melee range', () => {
    expect(attackInRange.evaluate(ctx([obs(7, 8, 5, ['player'])], openLevel()))).toBeNull();
  });
});

describe('attackInRange — ranged reach', () => {
  it('attacks a distant hostile on a clear line', () => {
    const result = attackInRange.evaluate(
      ctx([obs(7, 5, 9, ['player'])], openLevel(), { capability: bow }),
    );
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 7 } });
  });

  it('does not attack when the line is blocked by a wall', () => {
    const level = openLevel();
    level.tiles[7][5] = 'wall'; // between attacker (5,5) and target (5,9)
    expect(
      attackInRange.evaluate(ctx([obs(7, 5, 9, ['player'])], level, { capability: bow })),
    ).toBeNull();
  });

  it('does not attack a hostile beyond weapon range', () => {
    const result = attackInRange.evaluate(
      ctx([obs(7, 5, 9, ['player'])], openLevel(), { capability: { range: 2, meleeRange: 1 } }),
    );
    expect(result).toBeNull();
  });

  it('targets the nearest attackable hostile', () => {
    const entities = [obs(7, 5, 9, ['player']), obs(8, 5, 7, ['player'])];
    const result = attackInRange.evaluate(ctx(entities, openLevel(), { capability: bow }));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 8 } });
  });

  it('skips a nearer blocked hostile for a farther one with a clear shot', () => {
    const level = openLevel();
    // Nearer hostile at (7,5) sits behind a wall at (6,5); farther one at (3,5) is in the clear.
    level.tiles[5][6] = 'wall';
    const entities = [obs(7, 7, 5, ['player']), obs(8, 3, 5, ['player'])];
    const result = attackInRange.evaluate(ctx(entities, level, { capability: bow }));
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: 8 } });
  });
});
