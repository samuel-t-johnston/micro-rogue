import { describe, it, expect, beforeEach } from 'vitest';
import { applyEffect, EffectTypes } from './effects.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from '../world/components.js';

function makeSubject() {
  const registry = createEntityRegistry();
  const e = registry.createEntity();
  registry.addComponent(e, 'health', components.health(10, 20));
  return { registry, e };
}

describe('effectHeal', () => {
  it('adds HP to the target', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.HEAL, e, null, { amount: 5 });
    expect(e.components.get('health').current).toBe(15);
  });

  it('clamps at health.max — no overheal', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.HEAL, e, null, { amount: 999 });
    expect(e.components.get('health').current).toBe(20);
  });

  it('defaults target to user when target is null', () => {
    const { e: user } = makeSubject();
    applyEffect(EffectTypes.HEAL, user, null, { amount: 3 });
    expect(user.components.get('health').current).toBe(13);
  });

  it('targets the explicit target when provided', () => {
    const { e: user } = makeSubject();
    const { e: target } = makeSubject();
    target.components.get('health').current = 5;
    applyEffect(EffectTypes.HEAL, user, target, { amount: 4 });
    expect(user.components.get('health').current).toBe(10); // unchanged
    expect(target.components.get('health').current).toBe(9);
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
    expect(e.components.get('health').current).toBe(6);
  });

  it('clamps at 0 (no negative HP until M3 death system)', () => {
    const { e } = makeSubject();
    applyEffect(EffectTypes.DAMAGE, e, null, { amount: 999 });
    expect(e.components.get('health').current).toBe(0);
  });

  it('defaults target to user when target is null', () => {
    const { e: user } = makeSubject();
    applyEffect(EffectTypes.DAMAGE, user, null, { amount: 2 });
    expect(user.components.get('health').current).toBe(8);
  });
});

describe('applyEffect dispatch', () => {
  it('throws on an unknown effect type', () => {
    const { e } = makeSubject();
    expect(() => applyEffect('nope', e, null, {})).toThrow(/Unknown effect type: nope/);
  });
});
