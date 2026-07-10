import { describe, it, expect } from 'vitest';
import { applyEffect, EffectTypes } from './effects.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { getPool } from '../../attributes/attribute-access.js';

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

describe('effectSatiate', () => {
  // hunger is a pool whose max scales with con; con 0 → max 0, so give the subject con for headroom.
  function makeEater() {
    const registry = createEntityRegistry();
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes({ hunger: 10, con: 10 }));
    return { registry, e };
  }

  it('adds hunger to the target', () => {
    const { e } = makeEater();
    applyEffect(EffectTypes.SATIATE, e, null, { amount: 30 });
    expect(e.components.get('attributes').hunger).toBe(40);
  });

  it('clamps at hunger.max — eating past full is wasted', () => {
    const { e } = makeEater();
    applyEffect(EffectTypes.SATIATE, e, null, { amount: 999 });
    expect(getPool(e, 'hunger').current).toBe(getPool(e, 'hunger').max);
  });

  it('is a no-op when the subject has no hunger pool', () => {
    const registry = createEntityRegistry();
    const e = registry.createEntity();
    const result = applyEffect(EffectTypes.SATIATE, e, null, { amount: 5 });
    expect(result.applied).toBe(false);
  });
});

describe('applyEffect dispatch', () => {
  it('throws on an unknown effect type', () => {
    const { e } = makeSubject();
    expect(() => applyEffect('nope', e, null, {})).toThrow(/Unknown effect type: nope/);
  });
});
