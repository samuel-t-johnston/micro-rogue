import { describe, it, expect } from 'vitest';
import { performSearch, searchChance } from './search.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';
import { createSecretDoor } from '../entities/furniture.js';
import { components } from '../entities/components.js';
import { createRng } from '../../engine/core/rng.js';

function makeLevel(w = 9, h = 1) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  return level;
}

function makeActor(registry, x, y, int) {
  const a = registry.createEntity();
  registry.addComponent(a, 'position', components.position(x, y));
  if (int != null) registry.addComponent(a, 'attributes', components.attributes({ int }));
  return a;
}

function placeSecret(registry, level, x, y) {
  const s = createSecretDoor(registry, x, y, { revealFloor: 'floor' });
  level.placeEntity(s);
  return s;
}

// A stub rng that yields a fixed value (or a queue of values, one per draw).
const fixedRng = (v) => ({ random: () => v });
const queueRng = (vals) => {
  let i = 0;
  return { random: () => vals[i++] };
};

describe('searchChance', () => {
  it('is 5% + 5% per INT at full (adjacent, active)', () => {
    expect(searchChance(1, 1, false)).toBeCloseTo(0.1);
    expect(searchChance(0, 1, false)).toBeCloseTo(0.05);
  });

  it('halves at distance 2', () => {
    expect(searchChance(1, 2, false)).toBeCloseTo(0.05);
  });

  it('halves again for passive, compounding with distance', () => {
    expect(searchChance(1, 1, true)).toBeCloseTo(0.05);
    expect(searchChance(1, 2, true)).toBeCloseTo(0.025);
  });

  it('caps base effectiveness at 95%', () => {
    expect(searchChance(18, 1, false)).toBeCloseTo(0.95);
    expect(searchChance(100, 1, false)).toBeCloseTo(0.95);
  });

  it('is zero beyond distance 2', () => {
    expect(searchChance(100, 3, false)).toBe(0);
  });
});

describe('performSearch', () => {
  it('reveals an in-range secret when the roll succeeds', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, 0, 0, 1);
    const secret = placeSecret(registry, level, 1, 0);

    const revealed = performSearch(actor, level, registry, { rng: fixedRng(0) });

    expect(revealed).toEqual([secret]);
    expect(secret.components.has('secret')).toBe(false);
    expect(level.getTile(1, 0)).toBe('floor');
  });

  it('leaves the secret hidden when the roll fails', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, 0, 0, 1);
    const secret = placeSecret(registry, level, 1, 0);

    const revealed = performSearch(actor, level, registry, { rng: fixedRng(0.999) });

    expect(revealed).toEqual([]);
    expect(secret.components.has('secret')).toBe(true);
    expect(level.getTile(1, 0)).toBe('wall');
  });

  it('ignores secrets beyond distance 2, even on a guaranteed roll', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, 0, 0, 1);
    const far = placeSecret(registry, level, 3, 0); // Chebyshev distance 3

    const revealed = performSearch(actor, level, registry, { rng: fixedRng(0) });

    expect(revealed).toEqual([]);
    expect(far.components.has('secret')).toBe(true);
  });

  it('passive search is half as likely as active for the same tile', () => {
    // INT 1 → active adjacent 10%, passive adjacent 5%. A roll of 0.07 clears active but not passive.
    const build = () => {
      const registry = createEntityRegistry();
      const level = makeLevel();
      const actor = makeActor(registry, 0, 0, 1);
      const secret = placeSecret(registry, level, 1, 0);
      return { registry, level, actor, secret };
    };

    const active = build();
    performSearch(active.actor, active.level, active.registry, { rng: fixedRng(0.07) });
    expect(active.secret.components.has('secret')).toBe(false);

    const passive = build();
    performSearch(passive.actor, passive.level, passive.registry, {
      passive: true,
      rng: fixedRng(0.07),
    });
    expect(passive.secret.components.has('secret')).toBe(true);
  });

  it('rolls independently, once per in-range candidate', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, 0, 0, 1);
    const near = placeSecret(registry, level, 1, 0);
    const near2 = placeSecret(registry, level, 2, 0);

    // First draw succeeds, second fails — so exactly the first candidate is revealed.
    const revealed = performSearch(actor, level, registry, { rng: queueRng([0, 0.999]) });

    expect(revealed).toEqual([near]);
    expect(near2.components.has('secret')).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const registry = createEntityRegistry();
      const level = makeLevel();
      const actor = makeActor(registry, 0, 0, 10);
      placeSecret(registry, level, 1, 0);
      placeSecret(registry, level, 2, 0);
      return performSearch(actor, level, registry, { rng: createRng(1234) }).length;
    };
    expect(run()).toBe(run());
  });
});
