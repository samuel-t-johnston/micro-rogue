import { describe, it, expect, beforeEach } from 'vitest';
import { createHealingPotion, createPotionOfPain } from './items.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { EffectTypes } from '../effects/effects.js';

describe('createHealingPotion', () => {
  let registry, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    potion = createHealingPotion(registry, 3, 4);
  });

  it('places the potion at the given position', () => {
    expect(potion.components.get('position')).toEqual({ x: 3, y: 4 });
  });

  it('has the item component with map location', () => {
    expect(potion.components.get('item').location).toEqual({ type: 'map' });
  });

  it('is renderable', () => {
    expect(potion.components.has('renderable')).toBe(true);
  });

  it('does not block movement', () => {
    expect(potion.components.has('blocksMovement')).toBe(false);
  });

  it('is consumable with a heal effect', () => {
    const consumable = potion.components.get('consumable');
    expect(consumable.effectType).toBe(EffectTypes.HEAL);
    expect(consumable.params.amount).toBe(10);
  });
});

describe('createPotionOfPain', () => {
  let registry, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    potion = createPotionOfPain(registry, 1, 1);
  });

  it('is consumable with a damage effect', () => {
    const consumable = potion.components.get('consumable');
    expect(consumable.effectType).toBe(EffectTypes.DAMAGE);
    expect(consumable.params.amount).toBe(5);
  });
});
