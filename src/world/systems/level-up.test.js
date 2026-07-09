import { describe, it, expect, beforeEach } from 'vitest';
import { distributeLevelUpPoints, watchLevelUp } from './level-up.js';
import { getScore } from '../../attributes/attribute-access.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../entities/components.js';

// The default player spec: one point per level, an even split over STR→DEX→CON, INT never.
const EVEN_STR_DEX_CON = { str: 0.33, dex: 0.33, con: 0.33, int: 0 };

describe('distributeLevelUpPoints', () => {
  it('places nothing for zero points', () => {
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 0)).toEqual({
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
    });
  });

  it('round-robins STR → DEX → CON in declared order', () => {
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 1)).toEqual({
      str: 1,
      dex: 0,
      con: 0,
      int: 0,
    });
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 2)).toEqual({
      str: 1,
      dex: 1,
      con: 0,
      int: 0,
    });
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 3)).toEqual({
      str: 1,
      dex: 1,
      con: 1,
      int: 0,
    });
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 6)).toEqual({
      str: 2,
      dex: 2,
      con: 2,
      int: 0,
    });
  });

  it('never allocates to a zero-share attribute', () => {
    expect(distributeLevelUpPoints(EVEN_STR_DEX_CON, 30).int).toBe(0);
  });

  it('splits evenly across a four-way even share', () => {
    const share = { a: 0.25, b: 0.25, c: 0.25, d: 0.25 };
    expect(distributeLevelUpPoints(share, 4)).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(distributeLevelUpPoints(share, 8)).toEqual({ a: 2, b: 2, c: 2, d: 2 });
  });
});

describe('watchLevelUp', () => {
  let registry;

  function makeLeveler({ dynamic = true, maxLevel = 25, points = 1, xp = 0, player = false } = {}) {
    const e = registry.createEntity();
    registry.addComponent(
      e,
      'attributes',
      components.attributes({ str: 5, dex: 5, con: 5, int: 5, xp }),
    );
    registry.addComponent(
      e,
      'levelUp',
      components.levelUp({ dynamic, points, attributePercentages: EVEN_STR_DEX_CON, maxLevel }),
    );
    if (player) registry.addComponent(e, 'playerControlled', components.playerControlled());
    return e;
  }

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('allocates one point on a single level gain', () => {
    const e = makeLeveler({ xp: 10 }); // xp 10 → level 2
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(6);
    expect(getScore(e, 'dex')).toBe(5);
    expect(e.components.get('levelUp').lastLevel).toBe(2);
  });

  it('allocates the whole distribution across a multi-level jump', () => {
    const e = makeLeveler({ xp: 60 }); // xp 60 → level 4, three points from level 1
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(6);
    expect(getScore(e, 'dex')).toBe(6);
    expect(getScore(e, 'con')).toBe(6);
    expect(e.components.get('levelUp').lastLevel).toBe(4);
  });

  it('continues the round-robin across separate level-ups', () => {
    const e = makeLeveler({ xp: 10 }); // → level 2, +1 STR
    watchLevelUp(e);
    // Bump xp to level 3 and poll again: the second point must land on DEX, not restart at STR.
    e.components.get('attributes').xp = 30;
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(6);
    expect(getScore(e, 'dex')).toBe(6);
    expect(getScore(e, 'con')).toBe(5);
  });

  it('stops allocating at maxLevel', () => {
    const e = makeLeveler({ xp: 60, maxLevel: 2 }); // level 4, but capped at 2 → one point only
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(6);
    expect(getScore(e, 'dex')).toBe(5);
    expect(e.components.get('levelUp').lastLevel).toBe(2);
  });

  it('does nothing for a non-dynamic entity', () => {
    const e = makeLeveler({ xp: 60, dynamic: false });
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(5);
    expect(e.components.get('levelUp').lastLevel).toBe(1);
  });

  it('does nothing when the level has not advanced', () => {
    const e = makeLeveler({ xp: 0 });
    watchLevelUp(e);
    expect(getScore(e, 'str')).toBe(5);
    expect(e.components.get('levelUp').lastLevel).toBe(1);
  });

  it('ignores an entity with no levelUp component', () => {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes({ str: 5, xp: 60 }));
    expect(() => watchLevelUp(e)).not.toThrow();
    expect(getScore(e, 'str')).toBe(5);
  });
});
