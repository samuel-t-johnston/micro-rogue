import { describe, it, expect, beforeEach } from 'vitest';
import { createHealingPotion, createPotionOfPain, createSword, createLeatherArmor, createScroll, createAmulet } from './items.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { EffectTypes } from '../effects/effects.js';
import { Slots } from '../../data/equipment-slots.js';

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

describe('new items', () => {
  let registry;
  beforeEach(() => { registry = createEntityRegistry(); });

  it('sword is a weapon with an attack bonus', () => {
    const sword = createSword(registry, 1, 1);
    expect(sword.components.get('equippable').slot).toBe(Slots.WEAPON);
    expect(sword.components.get('attributeModifiers').attackDamage).toBe(3);
  });

  it('leather armor is equippable in the armor slot with an HP bonus', () => {
    const armor = createLeatherArmor(registry, 1, 1);
    expect(armor.components.get('equippable').slot).toBe(Slots.ARMOR);
    expect(armor.components.get('attributeModifiers').HP).toBe(5);
  });

  it('scroll is consumable with a heal effect', () => {
    const scroll = createScroll(registry, 1, 1);
    expect(scroll.components.get('consumable').effectType).toBe(EffectTypes.HEAL);
    expect(scroll.components.get('consumable').params.amount).toBe(15);
  });

  it('amulet is a quest item with no consumable/equippable behavior', () => {
    const amulet = createAmulet(registry, 1, 1);
    expect(amulet.components.get('questItem').id).toBe('amulet-of-yendor');
    expect(amulet.components.has('consumable')).toBe(false);
    expect(amulet.components.has('equippable')).toBe(false);
  });
});
