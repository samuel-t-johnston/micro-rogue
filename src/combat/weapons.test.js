import { describe, it, expect, beforeEach } from 'vitest';
import { getEquippedWeapon, getWeaponStats, getAttackCapability, resolveAmmo } from './weapons.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { Slots, HUMANOID_SLOTS } from '../../data/equipment-slots.js';

describe('weapons resolver', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  function makeActor(slots = HUMANOID_SLOTS) {
    const e = registry.createEntity();
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(slots));
    return e;
  }

  // Equips an item directly into a slot (bypassing the equip action — these tests exercise the
  // resolver, not equipping).
  function equip(actor, slot, item) {
    actor.components.get('wearsEquipment').slots[slot] = item;
  }

  function makeWeapon(range, opts) {
    const e = registry.createEntity();
    registry.addComponent(e, 'weapon', components.weapon(range, opts));
    return e;
  }

  describe('getEquippedWeapon', () => {
    it('returns the item in the weapon slot', () => {
      const actor = makeActor();
      const sword = makeWeapon(1);
      equip(actor, Slots.WEAPON, sword);
      expect(getEquippedWeapon(actor)).toBe(sword);
    });

    it('returns null when the weapon slot is empty', () => {
      expect(getEquippedWeapon(makeActor())).toBe(null);
    });

    it('returns null when the entity wears no equipment', () => {
      expect(getEquippedWeapon(registry.createEntity())).toBe(null);
    });
  });

  describe('getWeaponStats', () => {
    it('falls back to unarmed melee when no weapon is equipped', () => {
      expect(getWeaponStats(makeActor())).toEqual({
        range: 1,
        meleeRange: 1,
        ammoType: null,
        breakChance: 0,
        attackSprites: {},
      });
    });

    it('falls back to unarmed when the equipped item has no weapon component (old save)', () => {
      const actor = makeActor();
      const oldDagger = registry.createEntity();
      registry.addComponent(oldDagger, 'equippable', components.equippable(Slots.WEAPON));
      equip(actor, Slots.WEAPON, oldDagger);
      expect(getWeaponStats(actor)).toMatchObject({ range: 1, meleeRange: 1, ammoType: null });
    });

    it('reports the equipped weapon stats', () => {
      const actor = makeActor();
      equip(actor, Slots.WEAPON, makeWeapon(15, { meleeRange: 0, ammoType: 'arrow' }));
      expect(getWeaponStats(actor)).toMatchObject({
        range: 15,
        meleeRange: 0,
        ammoType: 'arrow',
      });
    });

    it('fills fields absent from a partial weapon component', () => {
      const actor = makeActor();
      const spear = registry.createEntity();
      // A degraded/partial component (e.g. from older data): only range is set.
      registry.addComponent(spear, 'weapon', { range: 2 });
      equip(actor, Slots.WEAPON, spear);
      expect(getWeaponStats(actor)).toEqual({
        range: 2,
        meleeRange: 1,
        ammoType: null,
        breakChance: 0,
        attackSprites: {},
      });
    });

    it('returns a copy so callers cannot mutate the stored component', () => {
      const actor = makeActor();
      equip(actor, Slots.WEAPON, makeWeapon(2, { attackSprites: { N: 'spear-n' } }));
      const stats = getWeaponStats(actor);
      stats.range = 99;
      stats.attackSprites.N = 'changed';
      expect(getWeaponStats(actor)).toMatchObject({ range: 2 });
      expect(getWeaponStats(actor).attackSprites).toEqual({ N: 'spear-n' });
    });
  });

  describe('getAttackCapability', () => {
    it('exposes only range and meleeRange', () => {
      const actor = makeActor();
      equip(actor, Slots.WEAPON, makeWeapon(2, { meleeRange: 1, ammoType: 'self' }));
      expect(getAttackCapability(actor)).toEqual({ range: 2, meleeRange: 1 });
    });

    it('defaults to adjacent melee when unarmed', () => {
      expect(getAttackCapability(makeActor())).toEqual({ range: 1, meleeRange: 1 });
    });
  });

  describe('resolveAmmo', () => {
    function makeArrows(ammoType = 'arrow', count = 20) {
      const e = registry.createEntity();
      registry.addComponent(e, 'ammunition', components.ammunition(ammoType));
      registry.addComponent(e, 'stackable', components.stackable(100, count));
      return e;
    }

    it('returns null for a weapon that needs no ammo', () => {
      expect(resolveAmmo(makeActor(), null)).toBe(null);
    });

    it("resolves 'self' ammo to the equipped weapon", () => {
      const actor = makeActor();
      const javelin = makeWeapon(15, { ammoType: 'self' });
      equip(actor, Slots.WEAPON, javelin);
      expect(resolveAmmo(actor, 'self')).toEqual({ stack: javelin, slot: Slots.WEAPON });
    });

    it("returns null for 'self' ammo when no weapon is equipped", () => {
      expect(resolveAmmo(makeActor(), 'self')).toBe(null);
    });

    it('resolves matching ammunition from the ammunition slot', () => {
      const actor = makeActor();
      const arrows = makeArrows('arrow');
      equip(actor, Slots.AMMUNITION, arrows);
      expect(resolveAmmo(actor, 'arrow')).toEqual({ stack: arrows, slot: Slots.AMMUNITION });
    });

    it('returns null when the quiver holds the wrong ammo type', () => {
      const actor = makeActor();
      equip(actor, Slots.AMMUNITION, makeArrows('bolt'));
      expect(resolveAmmo(actor, 'arrow')).toBe(null);
    });

    it('returns null when the ammunition slot is empty', () => {
      expect(resolveAmmo(makeActor(), 'arrow')).toBe(null);
    });

    it('returns null when the quiver is empty (count 0)', () => {
      const actor = makeActor();
      equip(actor, Slots.AMMUNITION, makeArrows('arrow', 0));
      expect(resolveAmmo(actor, 'arrow')).toBe(null);
    });
  });
});
