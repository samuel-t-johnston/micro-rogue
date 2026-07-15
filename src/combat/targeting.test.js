import { describe, it, expect } from 'vitest';
import { isDamageable, isAttackable } from './targeting.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { createLevel } from '../world/map/level.js';
import { components } from '../world/entities/components.js';

describe('isDamageable', () => {
  const registry = createEntityRegistry();
  const withAttrs = (attrs) => {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes(attrs));
    return e;
  };

  it('is true for a creature that stores only its hp base (undamaged, current defaults to full)', () => {
    expect(isDamageable(withAttrs({ hpBase: 5 }))).toBe(true);
  });

  it('is true for a creature with a stored current hp', () => {
    expect(isDamageable(withAttrs({ hp: 3, hpBase: 5 }))).toBe(true);
  });

  it('is false for an entity with no hp pool', () => {
    expect(isDamageable(withAttrs({ str: 5, mp: 2 }))).toBe(false);
  });

  it('is false for an entity with no attributes at all', () => {
    expect(isDamageable(registry.createEntity())).toBe(false);
  });
});

describe('isAttackable', () => {
  const from = { x: 1, y: 1 };
  const MELEE = { range: 1, meleeRange: 1 };
  const BOW = { range: 5, meleeRange: 1 };

  function floorLevel(w = 7, h = 3) {
    const level = createLevel();
    level.width = w;
    level.height = h;
    level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
    return level;
  }

  it('is false for the actor’s own tile', () => {
    expect(isAttackable(floorLevel(), from, { x: 1, y: 1 }, MELEE)).toBe(false);
  });

  it('is false beyond weapon range', () => {
    expect(isAttackable(floorLevel(), from, { x: 3, y: 1 }, MELEE)).toBe(false); // distance 2 > range 1
  });

  it('is true within meleeRange, no line check', () => {
    expect(isAttackable(floorLevel(), from, { x: 2, y: 1 }, MELEE)).toBe(true);
  });

  it('is true for a ranged target on a clear line', () => {
    expect(isAttackable(floorLevel(), from, { x: 4, y: 1 }, BOW)).toBe(true); // distance 3, open floor
  });

  it('is false when a wall blocks the line short of the target', () => {
    const level = floorLevel();
    level.tiles[1][2] = 'wall'; // between shooter and target
    expect(isAttackable(level, from, { x: 4, y: 1 }, BOW)).toBe(false);
  });
});
