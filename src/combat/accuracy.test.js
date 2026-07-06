import { describe, it, expect, beforeEach } from 'vitest';
import { missChance, rollsMiss, MISS_MAX } from './accuracy.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { rng } from '../engine/core/rng.js';

describe('missChance', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  function actorWithDex(dex) {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes({ dex }));
    return e;
  }

  it('is base 0.25 at zero DEX and zero distance', () => {
    expect(missChance(actorWithDex(0), 0)).toBeCloseTo(0.25);
  });

  it('rises 1% per tile of distance', () => {
    expect(missChance(actorWithDex(0), 5)).toBeCloseTo(0.3);
  });

  it('falls 1% per point of DEX', () => {
    expect(missChance(actorWithDex(10), 0)).toBeCloseTo(0.15);
  });

  it('caps the DEX benefit at 20 (a maxed archer sits at ~6% at range 1)', () => {
    expect(missChance(actorWithDex(20), 1)).toBeCloseTo(0.06);
    expect(missChance(actorWithDex(40), 1)).toBeCloseTo(0.06); // DEX beyond 20 does nothing more
  });

  it('never promises a certain hit — clamps to MISS_MAX at extreme range', () => {
    expect(missChance(actorWithDex(0), 500)).toBe(MISS_MAX);
  });
});

describe('rollsMiss', () => {
  it('misses iff the gameplay RNG draw falls under the miss chance', () => {
    const registry = createEntityRegistry();
    const actor = registry.createEntity();
    registry.addComponent(actor, 'attributes', components.attributes({ dex: 5 }));

    rng.init(42);
    const draw = rng.random();
    rng.init(42);
    expect(rollsMiss(actor, 3)).toBe(draw < missChance(actor, 3));
  });
});
