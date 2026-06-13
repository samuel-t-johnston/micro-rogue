import { describe, it, expect, beforeEach } from 'vitest';
import { rng, createRng, createRngService, hashName, deriveSeed } from './rng.js';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.random(), a.random(), a.random()]).toEqual([b.random(), b.random(), b.random()]);
  });

  it('diverges for different seeds', () => {
    expect(createRng(1).random()).not.toBe(createRng(2).random());
  });

  it('getState/setState restores the exact position', () => {
    const r = createRng(7);
    r.random();
    const state = r.getState();
    const next = r.random();
    r.setState(state);
    expect(r.random()).toBe(next);
  });

  it('nextInt stays in [min, max) and pick returns an element', () => {
    const r = createRng(3);
    for (let i = 0; i < 200; i++) {
      const v = r.nextInt(3, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });
});

describe('mix helpers', () => {
  it('hashName is deterministic and name-sensitive', () => {
    expect(hashName('gameplay')).toBe(hashName('gameplay'));
    expect(hashName('gameplay')).not.toBe(hashName('mapgen'));
  });

  it('deriveSeed is deterministic and order-sensitive', () => {
    expect(deriveSeed(1, 2, 3)).toBe(deriveSeed(1, 2, 3));
    expect(deriveSeed(1, 2, 3)).not.toBe(deriveSeed(1, 3, 2));
  });
});

describe('createRngService', () => {
  it('stream(name) returns one cached, advancing instance', () => {
    const s = createRngService(99);
    expect(s.stream('gameplay')).toBe(s.stream('gameplay'));
    expect(s.stream('gameplay').random()).not.toBe(s.stream('gameplay').random());
  });

  it('the same master + name reproduces a stream across services', () => {
    const a = createRngService(99).stream('gameplay');
    const b = createRngService(99).stream('gameplay');
    expect([a.random(), a.random()]).toEqual([b.random(), b.random()]);
  });

  it('different stream names are independent', () => {
    const seqA = (() => { const r = createRngService(99).stream('combat'); return [r.random(), r.random()]; })();
    const seqB = (() => { const r = createRngService(99).stream('loot'); return [r.random(), r.random()]; })();
    expect(seqA).not.toEqual(seqB);
  });

  it('derive(name, ...mix) is reproducible by key and varies with it', () => {
    const s = createRngService(99);
    const a = s.derive('mapgen', 0, 3);
    const b = s.derive('mapgen', 0, 3);
    expect([a.random(), a.random()]).toEqual([b.random(), b.random()]);
    expect(s.derive('mapgen', 1, 3).random()).not.toBe(s.derive('mapgen', 0, 3).random());
  });

  it('snapshot/restore round-trips persistent streams', () => {
    const s = createRngService(99);
    s.stream('gameplay').random();
    s.stream('gameplay').random();
    const snap = s.snapshot();
    const next = s.stream('gameplay').random();

    const s2 = createRngService(snap.seed);
    s2.restore(snap);
    expect(s2.stream('gameplay').random()).toBe(next);
    expect(snap.seed).toBe(99);
  });
});

describe('generation is independent of gameplay', () => {
  it('a derived mapgen stream is unaffected by how far the gameplay stream advanced', () => {
    rng.init(12345);
    const seqA = (() => { const r = rng.deriveRng('mapgen', 0, 0); return [r.random(), r.random(), r.random()]; })();

    for (let i = 0; i < 17; i++) rng.random(); // churn the gameplay stream

    const seqB = (() => { const r = rng.deriveRng('mapgen', 0, 0); return [r.random(), r.random(), r.random()]; })();
    expect(seqB).toEqual(seqA);
  });
});

describe('ambient rng (gameplay façade)', () => {
  beforeEach(() => rng.init(12345));

  it('reproduces the gameplay sequence for the same master seed', () => {
    const first = [rng.random(), rng.random(), rng.random()];
    rng.init(12345);
    expect([rng.random(), rng.random(), rng.random()]).toEqual(first);
  });

  it('diverges for different master seeds', () => {
    const a = rng.random();
    rng.init(12346);
    expect(rng.random()).not.toBe(a);
  });

  it('init() without a seed picks a random master', () => {
    rng.init();
    const a = rng.getMasterSeed();
    rng.init();
    const b = rng.getMasterSeed();
    expect(a).not.toBe(b);
  });

  it('nextInt and pick draw from the gameplay stream', () => {
    expect(Number.isInteger(rng.nextInt(0, 5))).toBe(true);
    expect(['x', 'y']).toContain(rng.pick(['x', 'y']));
  });

  it('a new named persistent stream is captured in the snapshot (forkability)', () => {
    rng.random();              // touch gameplay
    rng.stream('spawns').random(); // a fork-defined persistent stream
    const snap = rng.snapshot();
    expect(snap.streams).toHaveProperty('gameplay');
    expect(snap.streams).toHaveProperty('spawns');
  });
});
