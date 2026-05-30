import { describe, it, expect, beforeEach } from 'vitest';
import { rng } from './rng.js';

const FIXED_SEED = 12345;

beforeEach(() => {
  rng.init(FIXED_SEED);
});

describe('init', () => {
  it('stores the provided seed', () => {
    expect(rng.getSeed()).toBe(FIXED_SEED);
  });

  it('produces the same sequence when re-initialized with the same seed', () => {
    const first = [rng.random(), rng.random(), rng.random()];
    rng.init(FIXED_SEED);
    const second = [rng.random(), rng.random(), rng.random()];
    expect(first).toEqual(second);
  });

  it('produces different sequences for different seeds', () => {
    const first = rng.random();
    rng.init(FIXED_SEED + 1);
    const second = rng.random();
    expect(first).not.toBe(second);
  });

  it('generates a random seed when none is provided', () => {
    rng.init();
    const seedA = rng.getSeed();
    rng.init();
    const seedB = rng.getSeed();
    // Astronomically unlikely to collide
    expect(seedA).not.toBe(seedB);
  });
});

describe('random', () => {
  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = rng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('nextInt', () => {
  it('returns integers in [min, max)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(3, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });
});

describe('pick', () => {
  it('returns an element from the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});

describe('getState / setState', () => {
  it('restores the exact position in the sequence', () => {
    rng.random(); // advance once
    const state = rng.getState();
    const next = rng.random();

    rng.setState(state);
    expect(rng.random()).toBe(next);
  });

  it('allows resuming after a series of calls', () => {
    for (let i = 0; i < 50; i++) rng.random();
    const state = rng.getState();
    const tail = [rng.random(), rng.random(), rng.random()];

    rng.setState(state);
    expect([rng.random(), rng.random(), rng.random()]).toEqual(tail);
  });
});
