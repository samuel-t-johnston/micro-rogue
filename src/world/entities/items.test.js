import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHealingPotion,
  createPotionOfPain,
  createDagger,
  createSword,
  createSpear,
  createJavelin,
  createBow,
  createArrow,
  createLeatherArmor,
  createScroll,
  createAmulet,
} from './items.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { EffectTypes } from '../../effects/core/effects.js';
import { Slots } from '../../../data/equipment-slots.js';

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
  beforeEach(() => {
    registry = createEntityRegistry();
  });

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

describe('weapons get a weapon component', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('dagger is a melee weapon with range 1', () => {
    expect(createDagger(registry, 1, 1).components.get('weapon')).toMatchObject({
      range: 1,
      meleeRange: 1,
      ammoType: null,
    });
  });

  it('sword is a melee weapon with range 1', () => {
    expect(createSword(registry, 1, 1).components.get('weapon').range).toBe(1);
  });
});

describe('ranged weapons and ammunition', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('spear is a reach weapon: range 2, no ammo', () => {
    const spear = createSpear(registry, 1, 1);
    expect(spear.components.get('equippable').slot).toBe(Slots.WEAPON);
    expect(spear.components.get('weapon')).toMatchObject({
      range: 2,
      meleeRange: 1,
      ammoType: null,
    });
    expect(spear.components.get('attributeModifiers').attackDamage).toBe(2);
  });

  it('javelin is a self-thrown stackable weapon', () => {
    const javelin = createJavelin(registry, 1, 1);
    expect(javelin.components.get('weapon')).toMatchObject({
      range: 15,
      meleeRange: 1,
      ammoType: 'self',
    });
    expect(javelin.components.get('stackable')).toEqual({ maxStackSize: 5, count: 3 });
    expect(javelin.components.get('weapon').attackSprites.E).toBe('javelin-e');
  });

  it('bow fires arrows and never melees (meleeRange 0)', () => {
    const bow = createBow(registry, 1, 1);
    expect(bow.components.get('weapon')).toMatchObject({
      range: 15,
      meleeRange: 0,
      ammoType: 'arrow',
    });
    expect(bow.components.has('stackable')).toBe(false);
  });

  it('arrow is stackable ammunition with no passive stat bonus', () => {
    const arrow = createArrow(registry, 1, 1);
    expect(arrow.components.get('equippable').slot).toBe(Slots.AMMUNITION);
    expect(arrow.components.get('ammunition').ammoType).toBe('arrow');
    expect(arrow.components.get('stackable')).toEqual({ maxStackSize: 100, count: 20 });
    expect(arrow.components.has('attributeModifiers')).toBe(false);
  });

  it('arrow carries directional attack sprites for its flight animation', () => {
    const sprites = createArrow(registry, 1, 1).components.get('ammunition').attackSprites;
    expect(new Set(Object.keys(sprites))).toEqual(
      new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
    );
    expect(sprites.E).toBe('arrow-e');
  });
});
