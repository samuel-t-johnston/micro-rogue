import { describe, it, expect, beforeEach } from 'vitest';
import { getAttribute, Attributes } from './attributes.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from '../world/components.js';
import { Slots, HUMANOID_SLOTS } from '../../data/equipment-slots.js';

describe('getAttribute', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  function makeActor() {
    const e = registry.createEntity();
    registry.addComponent(e, 'attacker', components.attacker(1));
    registry.addComponent(e, 'health', components.health(8, 10));
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
    return e;
  }

  function makeWeapon(mods) {
    const w = registry.createEntity();
    registry.addComponent(w, 'attributeModifiers', components.attributeModifiers(mods));
    return w;
  }

  it('returns the base value when nothing is equipped', () => {
    const e = makeActor();
    expect(getAttribute(e, Attributes.ATTACK_DAMAGE)).toBe(1);
    expect(getAttribute(e, Attributes.HP)).toBe(10); // effective max
  });

  it('adds modifiers from worn equipment', () => {
    const e = makeActor();
    e.components.get('wearsEquipment').slots[Slots.WEAPON] = makeWeapon({ attackDamage: 1 });
    expect(getAttribute(e, Attributes.ATTACK_DAMAGE)).toBe(2);
  });

  it('sums modifiers across multiple worn items', () => {
    const e = makeActor();
    const slots = e.components.get('wearsEquipment').slots;
    slots[Slots.WEAPON] = makeWeapon({ attackDamage: 1 });
    slots[Slots.ARMOR] = makeWeapon({ attackDamage: 2 });
    expect(getAttribute(e, Attributes.ATTACK_DAMAGE)).toBe(4);
  });

  it('ignores empty slots and items without the relevant modifier', () => {
    const e = makeActor();
    const slots = e.components.get('wearsEquipment').slots;
    slots[Slots.WEAPON] = makeWeapon({ HP: 5 }); // no attackDamage key
    expect(getAttribute(e, Attributes.ATTACK_DAMAGE)).toBe(1);
  });

  it('returns 0 base for an unknown attribute', () => {
    const e = makeActor();
    expect(getAttribute(e, 'nonsense')).toBe(0);
  });

  it('treats a missing base component as 0', () => {
    const e = registry.createEntity(); // no attacker component
    expect(getAttribute(e, Attributes.ATTACK_DAMAGE)).toBe(0);
  });
});
