import { describe, it, expect } from 'vitest';
import { scentAt, depositScent, diffuseAndDecay, gradientDir, scentUpkeep, serializeScent, deserializeScent } from './scent.js';
import { createLevel } from './level.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from './components.js';

// Builds a level from rows of '.' (floor) and '#' (wall).
function makeLevel(rows) {
  const level = createLevel();
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map(r => [...r].map(c => (c === '#' ? 'wall' : 'floor')));
  return level;
}

const open5 = () => makeLevel(Array(5).fill('.....'));

describe('deposit / scentAt', () => {
  it('records deposited intensity at a tile', () => {
    const level = open5();
    depositScent(level, 'p', 2, 2, 10);
    expect(scentAt(level, 'p', 2, 2)).toBe(10);
  });

  it('caps a tile at the maximum', () => {
    const level = open5();
    depositScent(level, 'p', 2, 2, 250);
    expect(scentAt(level, 'p', 2, 2)).toBe(100);
  });

  it('does not deposit onto a wall tile', () => {
    const level = makeLevel(['.....', '..#..', '.....']);
    depositScent(level, 'p', 2, 1, 10);
    expect(scentAt(level, 'p', 2, 1)).toBe(0);
  });

  it('reads 0 for a profile that was never deposited', () => {
    expect(scentAt(open5(), 'nobody', 2, 2)).toBe(0);
  });
});

describe('diffuseAndDecay', () => {
  it('spreads scent to open neighbours while decaying the source', () => {
    const level = open5();
    depositScent(level, 'p', 2, 2, 100);
    diffuseAndDecay(level);
    expect(scentAt(level, 'p', 2, 2)).toBeLessThan(100); // source decayed + bled outward
    expect(scentAt(level, 'p', 3, 2)).toBeGreaterThan(0); // neighbour gained scent
  });

  it('does not let scent cross a full wall', () => {
    // A wall column at x=1 fully separates x=0 from x=2.
    const level = makeLevel(['.#.', '.#.', '.#.', '.#.', '.#.']);
    depositScent(level, 'p', 0, 2, 100);
    for (let i = 0; i < 20; i++) diffuseAndDecay(level);
    expect(scentAt(level, 'p', 2, 2)).toBe(0);
  });

  it('decays to nothing over time with no fresh deposits', () => {
    const level = open5();
    depositScent(level, 'p', 2, 2, 100);
    for (let i = 0; i < 100; i++) diffuseAndDecay(level);
    expect(scentAt(level, 'p', 2, 2)).toBe(0);
  });
});

describe('gradientDir', () => {
  it('points toward the stronger-scent neighbour', () => {
    const level = open5();
    depositScent(level, 'p', 4, 2, 100); // source due east
    for (let i = 0; i < 3; i++) diffuseAndDecay(level);
    expect(gradientDir(level, 'p', 1, 2)).toBe('E');
  });

  it('returns null when on a local peak (the source)', () => {
    const level = open5();
    depositScent(level, 'p', 2, 2, 100);
    expect(gradientDir(level, 'p', 2, 2)).toBeNull();
  });
});

describe('scentUpkeep', () => {
  function withSource(level, profile, intensity, x, y) {
    const registry = createEntityRegistry();
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'scentSource', components.scentSource({ profile, intensity }));
    level.placeEntity(e);
    return registry;
  }

  it('deposits each source at its tile after ageing the field', () => {
    const level = open5();
    const registry = withSource(level, 'p', 10, 2, 2);
    scentUpkeep(level, registry); // diffuse (empty) then deposit
    expect(scentAt(level, 'p', 2, 2)).toBe(10);
  });

  it('accumulates at a stationary source across rounds (deposit outpaces decay)', () => {
    const level = open5();
    const registry = withSource(level, 'p', 10, 2, 2);
    scentUpkeep(level, registry);
    scentUpkeep(level, registry);
    expect(scentAt(level, 'p', 2, 2)).toBeGreaterThan(10);
  });
});

describe('serialization', () => {
  it('round-trips deposited scent through the sparse form', () => {
    const level = open5();
    depositScent(level, 'player', 1, 2, 10);
    depositScent(level, 'orcs', 3, 4, 25);

    const data = serializeScent(level);
    const restored = open5();
    restored.scent = deserializeScent(data, level.width, level.height);

    expect(scentAt(restored, 'player', 1, 2)).toBe(10);
    expect(scentAt(restored, 'orcs', 3, 4)).toBe(25);
  });

  it('emits only non-zero cells (stays sparse)', () => {
    const level = open5();
    depositScent(level, 'player', 1, 2, 10);
    expect(serializeScent(level)).toEqual({ player: { '1,2': 10 } });
  });

  it('tolerates a missing scent field (saves predating scent)', () => {
    expect(deserializeScent(undefined, 5, 5).size).toBe(0);
  });
});
