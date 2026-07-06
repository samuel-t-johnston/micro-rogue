import { describe, it, expect } from 'vitest';
import { applyEffect, EffectTypes } from './effects.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';

function makeSubject() {
  const registry = createEntityRegistry();
  const e = registry.createEntity();
  registry.addComponent(e, 'attributes', components.attributes({ hp: 10, hpBase: 20, con: 0 })); // maxHP = hpBase
  return { registry, e };
}

describe('effectHeal', () => {
  it('adds HP to the target', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.HEAL, e, null, { amount: 5 });
    expect(e.components.get('attributes').hp).toBe(15);
  });

  it('clamps at health.max — no overheal', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.HEAL, e, null, { amount: 999 });
    expect(e.components.get('attributes').hp).toBe(20);
  });

  it('defaults target to user when target is null', () => {
    const { e: user } = makeSubject();
    applyEffect(EffectTypes.HEAL, user, null, { amount: 3 });
    expect(user.components.get('attributes').hp).toBe(13);
  });

  it('targets the explicit target when provided', () => {
    const { e: user } = makeSubject();
    const { e: target } = makeSubject();
    target.components.get('attributes').hp = 5;
    applyEffect(EffectTypes.HEAL, user, target, { amount: 4 });
    expect(user.components.get('attributes').hp).toBe(10); // unchanged
    expect(target.components.get('attributes').hp).toBe(9);
  });

  it('is a no-op when subject has no health', () => {
    const registry = createEntityRegistry();
    const e = registry.createEntity();
    expect(() => applyEffect(EffectTypes.HEAL, e, null, { amount: 5 })).not.toThrow();
  });
});

describe('effectDamage', () => {
  it('subtracts HP from the target', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.DAMAGE, e, null, { amount: 4 });
    expect(e.components.get('attributes').hp).toBe(6);
  });

  it('reduces HP to 0 and triggers death, destroying the entity', () => {
    const { registry, e } = makeSubject();
    const level = createLevel();
    applyEffect(EffectTypes.DAMAGE, e, null, { amount: 999 }, level, registry);
    expect(registry.getEntity(e.id)).toBeNull();
  });

  it('defaults target to user when target is null', () => {
    const { e: user } = makeSubject();
    applyEffect(EffectTypes.DAMAGE, user, null, { amount: 2 });
    expect(user.components.get('attributes').hp).toBe(8);
  });
});

describe('applyEffect dispatch', () => {
  it('throws on an unknown effect type', () => {
    const { e } = makeSubject();
    expect(() => applyEffect('nope', e, null, {})).toThrow(/Unknown effect type: nope/);
  });
});
