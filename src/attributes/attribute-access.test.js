import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScore,
  setScoreBase,
  getPool,
  adjustPool,
  setPoolCurrent,
  getAccumulator,
  addToAccumulator,
  hasAttribute,
  listAttributes,
  describeAttribute,
} from './attribute-access.js';
import { getDefinition, hasDefinition } from './attribute-registry.js';
import { Flavors } from './attribute-flavors.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { Slots, HUMANOID_SLOTS } from '../../data/equipment-slots.js';

describe('attribute registry', () => {
  it('resolves known attributes and throws on unknown', () => {
    expect(getDefinition('str').flavor).toBe(Flavors.SCORE);
    expect(getDefinition('hp').flavor).toBe(Flavors.POOL);
    expect(getDefinition('xp').flavor).toBe(Flavors.ACCUMULATOR);
    expect(hasDefinition('nonsense')).toBe(false);
    expect(() => getDefinition('nonsense')).toThrow(/unknown attribute/i);
  });
});

describe('attribute accessors', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  // An entity carrying an explicit attribute block plus equipment slots.
  function makeActor(attrs = {}) {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes(attrs));
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
    return e;
  }

  function equip(actor, slot, mods) {
    const item = registry.createEntity();
    registry.addComponent(item, 'attributeModifiers', components.attributeModifiers(mods));
    actor.components.get('wearsEquipment').slots[slot] = item;
    return item;
  }

  describe('score', () => {
    it('returns the stored base', () => {
      expect(getScore(makeActor({ str: 14 }), 'str')).toBe(14);
    });

    it('falls back to the definition default when unset', () => {
      expect(getScore(makeActor(), 'str')).toBe(10);
    });

    it('adds equipment modifiers to the base', () => {
      const e = makeActor({ str: 12 });
      equip(e, Slots.WEAPON, { str: 3 });
      equip(e, Slots.ARMOR, { str: 1 });
      expect(getScore(e, 'str')).toBe(16);
    });

    it('resolves attack as unarmed base plus weapon modifiers', () => {
      const e = makeActor({ attack: 1 });
      equip(e, Slots.WEAPON, { attack: 2 });
      expect(getScore(e, 'attack')).toBe(3);
    });

    it('setScoreBase writes the stored base', () => {
      const e = makeActor({ str: 10 });
      setScoreBase(e, 'str', 18);
      expect(getScore(e, 'str')).toBe(18);
    });

    it('reads defaults when the entity has no attributes component', () => {
      const bare = registry.createEntity();
      expect(getScore(bare, 'str')).toBe(10);
    });
  });

  describe('derived score: level', () => {
    it.each([
      [0, 1],
      [9, 1],
      [10, 2],
      [29, 2],
      [30, 3],
      [60, 4],
    ])('xp %i resolves to level %i', (xp, level) => {
      expect(getScore(makeActor({ xp }), 'level')).toBe(level);
    });
  });

  describe('pool', () => {
    it('derives max from its formula and reads absent current as full', () => {
      const e = makeActor({ con: 8 }); // maxHP = con
      expect(getPool(e, 'hp')).toEqual({ current: 8, max: 8 });
    });

    it('adds equipment modifiers to the derived max', () => {
      const e = makeActor({ con: 8 });
      equip(e, Slots.ARMOR, { hp: 4 });
      expect(getPool(e, 'hp')).toEqual({ current: 12, max: 12 });
    });

    it('clamps a stored current above a dropped max on read (non-destructive)', () => {
      const e = makeActor({ con: 10, hp: 10 });
      equip(e, Slots.ARMOR, { hp: -4 }); // maxHP now 6
      expect(getPool(e, 'hp')).toEqual({ current: 6, max: 6 });
    });

    it('adjustPool applies damage and healing, clamped to [0, max]', () => {
      const e = makeActor({ con: 10, hp: 10 });
      expect(adjustPool(e, 'hp', -3)).toEqual({ current: 7, max: 10 });
      expect(adjustPool(e, 'hp', -100)).toEqual({ current: 0, max: 10 });
      expect(adjustPool(e, 'hp', 100)).toEqual({ current: 10, max: 10 });
    });

    it('setPoolCurrent sets the current clamped to max', () => {
      const e = makeActor({ con: 10, hp: 2 });
      expect(setPoolCurrent(e, 'hp', 99)).toEqual({ current: 10, max: 10 });
    });

    it('mp max derives from int, hunger from con', () => {
      const e = makeActor({ int: 7, con: 5 });
      expect(getPool(e, 'mp').max).toBe(7);
      expect(getPool(e, 'hunger').max).toBe(50);
    });
  });

  describe('accumulator', () => {
    it('defaults to 0 and accrues monotonically', () => {
      const e = makeActor();
      expect(getAccumulator(e, 'xp')).toBe(0);
      expect(addToAccumulator(e, 'xp', 15)).toBe(15);
      expect(addToAccumulator(e, 'xp', 5)).toBe(20);
    });

    it('rejects a negative amount', () => {
      expect(() => addToAccumulator(makeActor(), 'xp', -1)).toThrow(/≥ 0/);
    });
  });

  describe('flavor guards', () => {
    it('rejects using the wrong accessor family for an attribute', () => {
      const e = makeActor({ str: 10, hp: 5, xp: 0, con: 5 });
      expect(() => getPool(e, 'str')).toThrow(/not a pool/);
      expect(() => getScore(e, 'hp')).toThrow(/not a score/);
      expect(() => getAccumulator(e, 'hp')).toThrow(/not a accumulator/);
    });

    it('throws when writing to an entity without an attributes component', () => {
      const bare = registry.createEntity();
      expect(() => setScoreBase(bare, 'str', 5)).toThrow(/no attributes component/);
    });
  });

  describe('display helpers', () => {
    it('hasAttribute reflects stored keys only', () => {
      const e = makeActor({ str: 10, hp: 5 });
      expect(hasAttribute(e, 'str')).toBe(true);
      expect(hasAttribute(e, 'mp')).toBe(false);
      expect(hasAttribute(e, 'level')).toBe(false); // derived, never stored
    });

    it('listAttributes returns stored attributes in registry order', () => {
      const e = makeActor({ hp: 5, str: 10, xp: 0 });
      expect(listAttributes(e)).toEqual(['str', 'hp', 'xp']);
    });

    it('describeAttribute tags each flavor with its resolved shape', () => {
      const e = makeActor({ str: 12, con: 9, hp: 9, xp: 40 });
      expect(describeAttribute(e, 'str')).toEqual({
        name: 'str',
        flavor: Flavors.SCORE,
        shortLabel: 'STR',
        longLabel: 'Strength',
        value: 12,
      });
      expect(describeAttribute(e, 'hp')).toEqual({
        name: 'hp',
        flavor: Flavors.POOL,
        shortLabel: 'HP',
        longLabel: 'Health',
        current: 9,
        max: 9,
      });
      expect(describeAttribute(e, 'xp')).toMatchObject({ flavor: Flavors.ACCUMULATOR, value: 40 });
    });
  });
});
