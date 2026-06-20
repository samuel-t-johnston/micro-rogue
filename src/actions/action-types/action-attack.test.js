import { describe, it, expect, beforeEach } from 'vitest';
import { executeAttack } from './action-attack.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../../world/level.js';
import { components } from '../../world/components.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';

describe('executeAttack', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = createLevel();
  });

  function makeActor(damage) {
    const e = registry.createEntity();
    registry.addComponent(e, 'attacker', components.attacker(damage));
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
    return e;
  }

  function makeTarget(hp, x = 2, y = 2) {
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'health', components.health(hp, hp));
    level.placeEntity(e);
    return e;
  }

  it('deals the resolved attack damage to the target', () => {
    const actor = makeActor(1);
    const target = makeTarget(5);

    const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

    expect(free).toBe(false); // consumes the turn
    expect(target.components.get('health').current).toBe(4);
  });

  it('includes worn-weapon modifiers in the damage', () => {
    const actor = makeActor(1);
    const dagger = registry.createEntity();
    registry.addComponent(dagger, 'attributeModifiers', components.attributeModifiers({ attackDamage: 1 }));
    actor.components.get('wearsEquipment').slots[Slots.WEAPON] = dagger;
    const target = makeTarget(5);

    executeAttack(actor, { targetEntityId: target.id }, level, registry);

    expect(target.components.get('health').current).toBe(3); // 1 base + 1 weapon
  });

  it('kills the target when damage reaches its HP, removing it', () => {
    const actor = makeActor(5);
    const target = makeTarget(3);

    executeAttack(actor, { targetEntityId: target.id }, level, registry);

    expect(registry.getEntity(target.id)).toBeNull();
    expect(level.entities).not.toContain(target);
  });

  it('still consumes the turn when the target is missing', () => {
    const actor = makeActor(1);
    expect(executeAttack(actor, { targetEntityId: 999 }, level, registry)).toBe(false);
  });

  it('emits a faction-neutral combat sound at the attacker\'s tile', () => {
    const actor = makeActor(1);
    registry.addComponent(actor, 'position', components.position(1, 1));
    level.placeEntity(actor);
    const target = makeTarget(5);

    executeAttack(actor, { targetEntityId: target.id }, level, registry);

    const sound = level.entities.find(e => e.components.has('sound'));
    expect(sound).toBeTruthy();
    expect(sound.components.get('position')).toEqual({ x: 1, y: 1 });
    expect(sound.components.get('sound')).toMatchObject({
      sourceId: actor.id, message: { kind: 'combat' }, sourceFactions: [],
    });
  });
});
