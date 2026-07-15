import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { resolveAttackDamage } from './attack-damage.js';

// A bare actor carrying just the attribute scores the formula reads (no equipment modifiers).
function actor(attrs) {
  const reg = createEntityRegistry();
  const e = reg.createEntity();
  reg.addComponent(e, 'attributes', components.attributes(attrs));
  return e;
}

describe('resolveAttackDamage', () => {
  it('melee adds half STR to the attack score', () => {
    // attack 4 + floor(str 6 / 2) = 4 + 3 = 7
    expect(resolveAttackDamage(actor({ attack: 4, str: 6, dex: 0 }), { isRanged: false })).toBe(7);
  });

  it('ranged scales off DEX, not STR', () => {
    // attack 4 + floor(dex 6 / 2) = 7; the huge STR is ignored for a ranged strike
    expect(resolveAttackDamage(actor({ attack: 4, str: 100, dex: 6 }), { isRanged: true })).toBe(7);
  });

  it('floors the half-ability bonus', () => {
    // attack 2 + floor(str 3 / 2) = 2 + 1 = 3 (the .5 is dropped, not rounded up)
    expect(resolveAttackDamage(actor({ attack: 2, str: 3, dex: 0 }), { isRanged: false })).toBe(3);
  });

  it('never deals less than 1', () => {
    expect(resolveAttackDamage(actor({ attack: 0, str: 0, dex: 0 }), { isRanged: false })).toBe(1);
  });
});
