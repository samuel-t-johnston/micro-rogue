import { describe, it, expect } from 'vitest';
import { components } from './components.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';

describe('weapon component', () => {
  it('defaults to an unarmed-equivalent melee weapon', () => {
    expect(components.weapon()).toEqual({
      range: 1,
      meleeRange: 1,
      ammoType: null,
      breakChance: 0,
      attackSprites: {},
    });
  });

  it('carries range plus the optional ranged parameters', () => {
    const w = components.weapon(15, { meleeRange: 0, ammoType: 'arrow', breakChance: 0.5 });
    expect(w).toMatchObject({ range: 15, meleeRange: 0, ammoType: 'arrow', breakChance: 0.5 });
  });

  it('copies attackSprites so callers cannot mutate a shared object', () => {
    const sprites = { N: 'arrow-n' };
    const w = components.weapon(2, { attackSprites: sprites });
    sprites.N = 'changed';
    expect(w.attackSprites).toEqual({ N: 'arrow-n' });
  });
});

describe('levelUp component', () => {
  it('defaults maxLevel to a finite, JSON-safe cap (Infinity would serialize to null)', () => {
    expect(Number.isFinite(components.levelUp().maxLevel)).toBe(true);
  });
});

describe('ammunition component', () => {
  it('stores ammoType with zero break chance and no sprites by default', () => {
    expect(components.ammunition('arrow')).toEqual({
      ammoType: 'arrow',
      breakChance: 0,
      attackSprites: {},
    });
  });

  it('copies attackSprites so callers cannot mutate a shared object', () => {
    const sprites = { E: 'arrow-e' };
    const a = components.ammunition('arrow', 0.25, sprites);
    sprites.E = 'changed';
    expect(a).toMatchObject({ breakChance: 0.25 });
    expect(a.attackSprites).toEqual({ E: 'arrow-e' });
  });
});

describe('stackable component', () => {
  it('defaults to a single, non-stacking item', () => {
    expect(components.stackable()).toEqual({ maxStackSize: 1, count: 1 });
  });

  it('carries a capacity and live count', () => {
    expect(components.stackable(100, 20)).toEqual({ maxStackSize: 100, count: 20 });
  });
});

describe('equipment slots', () => {
  it('defines an ammunition slot', () => {
    expect(Slots.AMMUNITION).toBe('ammunition');
  });

  it('gives humanoids a quiver alongside weapon and armor', () => {
    expect(HUMANOID_SLOTS).toContain(Slots.AMMUNITION);
    expect(HUMANOID_SLOTS).toEqual([Slots.WEAPON, Slots.ARMOR, Slots.AMMUNITION]);
  });
});
