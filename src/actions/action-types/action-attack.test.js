import { describe, it, expect, beforeEach } from 'vitest';
import { executeAttack } from './action-attack.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';
import { rng } from '../../engine/core/rng.js';
import { gameLog } from '../../engine/log/game-log.js';
import { animations } from '../../render/animations.js';

describe('executeAttack', () => {
  let registry, level;

  beforeEach(() => {
    rng.init(1);
    gameLog.reset();
    animations.reset();
    registry = createEntityRegistry();
    level = createLevel();
    level.width = 7;
    level.height = 7;
    level.tiles = Array.from({ length: 7 }, () => Array(7).fill('floor'));
  });

  function makeActor(damage) {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes({ attack: damage }));
    registry.addComponent(e, 'attacker', components.attacker());
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
    return e;
  }

  function makeTarget(hp, x = 2, y = 2) {
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'attributes', components.attributes({ hp, hpBase: hp, con: 0 })); // maxHP = hpBase
    level.placeEntity(e);
    return e;
  }

  // A positioned attacker — ranged/reach attacks need the actor on the map to trace the shot.
  function makeRangedActor({ x = 1, y = 1, damage = 2 } = {}) {
    const e = makeActor(damage);
    registry.addComponent(e, 'position', components.position(x, y));
    level.placeEntity(e);
    return e;
  }

  function equipWeapon(actor, range, opts = {}) {
    const w = registry.createEntity();
    registry.addComponent(w, 'name', components.name(opts.name ?? 'Weapon'));
    registry.addComponent(
      w,
      'item',
      components.item({ type: 'equipped', ownerId: actor.id, slot: Slots.WEAPON }),
    );
    registry.addComponent(w, 'weapon', components.weapon(range, opts));
    if (opts.stack != null) {
      registry.addComponent(w, 'stackable', components.stackable(opts.stack, opts.stack));
    }
    actor.components.get('wearsEquipment').slots[Slots.WEAPON] = w;
    return w;
  }

  function equipArrows(actor, count, attackSprites = {}) {
    const a = registry.createEntity();
    registry.addComponent(a, 'name', components.name('Arrow'));
    registry.addComponent(
      a,
      'renderable',
      components.renderable('arrow', '#101010', '↑', '#d8d2b8'),
    );
    registry.addComponent(
      a,
      'item',
      components.item({ type: 'equipped', ownerId: actor.id, slot: Slots.AMMUNITION }),
    );
    registry.addComponent(a, 'ammunition', components.ammunition('arrow', 0, attackSprites));
    registry.addComponent(a, 'stackable', components.stackable(100, count));
    actor.components.get('wearsEquipment').slots[Slots.AMMUNITION] = a;
    return a;
  }

  it('deals the resolved attack damage to the target', () => {
    const actor = makeActor(1);
    const target = makeTarget(5);

    const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

    expect(free).toBe(false); // consumes the turn
    expect(target.components.get('attributes').hp).toBe(4);
  });

  it('includes worn-weapon modifiers in the damage', () => {
    const actor = makeActor(1);
    const dagger = registry.createEntity();
    registry.addComponent(
      dagger,
      'attributeModifiers',
      components.attributeModifiers({ attack: 1 }),
    );
    actor.components.get('wearsEquipment').slots[Slots.WEAPON] = dagger;
    const target = makeTarget(5);

    executeAttack(actor, { targetEntityId: target.id }, level, registry);

    expect(target.components.get('attributes').hp).toBe(3); // 1 base + 1 weapon
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

  it("emits a faction-neutral combat sound at the attacker's tile", () => {
    const actor = makeActor(1);
    registry.addComponent(actor, 'position', components.position(1, 1));
    level.placeEntity(actor);
    const target = makeTarget(5);

    executeAttack(actor, { targetEntityId: target.id }, level, registry);

    const sound = level.entities.find((e) => e.components.has('sound'));
    expect(sound).toBeTruthy();
    expect(sound.components.get('position')).toEqual({ x: 1, y: 1 });
    expect(sound.components.get('sound')).toMatchObject({
      sourceId: actor.id,
      message: { kind: 'combat' },
      sourceFactions: [],
    });
  });

  describe('reach and ranged', () => {
    it('strikes a target beyond melee with a reach weapon, consuming nothing', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 3 });
      equipWeapon(actor, 2, { meleeRange: 1 }); // spear: range 2, no ammo
      const target = makeTarget(5, 3, 1); // distance 2, clear line

      const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(free).toBe(false);
      expect(target.components.get('attributes').hp).toBe(2);
    });

    it('fires a bow: consumes one arrow and damages the target', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      const arrows = equipArrows(actor, 5);
      const target = makeTarget(10, 4, 1); // distance 3, clear line

      const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(free).toBe(false);
      expect(target.components.get('attributes').hp).toBe(8);
      expect(arrows.components.get('stackable').count).toBe(4);
    });

    it('misfires as a free action for the player when no ammo is available', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      registry.addComponent(actor, 'playerControlled', components.playerControlled());
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' }); // no quiver equipped
      const target = makeTarget(10, 4, 1);

      const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(free).toBe(true); // turn not consumed
      expect(target.components.get('attributes').hp).toBe(10); // no damage
      expect(gameLog.getDisplayEntries(1)[0].display).toMatch(/no arrows/i);
    });

    it("consumes an NPC's turn on a misfire (no free retry loop)", () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 }); // no playerControlled
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      const target = makeTarget(10, 4, 1);

      const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(free).toBe(false); // turn spent — breaks the would-be infinite loop
      expect(target.components.get('attributes').hp).toBe(10);
    });

    it('clears the ammunition slot when the last arrow is fired', () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      equipArrows(actor, 1);
      const target = makeTarget(10, 4, 1);

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(actor.components.get('wearsEquipment').slots[Slots.AMMUNITION]).toBe(null);
    });

    it('logs using the last unit of ammo (external)', () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      equipArrows(actor, 1);
      const target = makeTarget(10, 4, 1);

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      const lines = gameLog.getDisplayEntries(5).map((e) => e.display);
      expect(lines.some((d) => /last arrow/i.test(d))).toBe(true);
    });

    it('logs using the last javelin (self ammo)', () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 1, ammoType: 'self', stack: 1, name: 'Javelin' });
      const target = makeTarget(10, 4, 1);

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      const lines = gameLog.getDisplayEntries(5).map((e) => e.display);
      expect(lines.some((d) => /last javelin/i.test(d))).toBe(true);
    });

    it('does not log a "last" line while ammo remains', () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      equipArrows(actor, 5);
      const target = makeTarget(10, 4, 1);

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      const lines = gameLog.getDisplayEntries(5).map((e) => e.display);
      expect(lines.some((d) => /last/i.test(d))).toBe(false);
    });

    it('throws a javelin (self ammo): consumes one from the weapon stack', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      const javelin = equipWeapon(actor, 15, { meleeRange: 1, ammoType: 'self', stack: 3 });
      const target = makeTarget(10, 4, 1); // distance 3, ranged

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(target.components.get('attributes').hp).toBe(8);
      expect(javelin.components.get('stackable').count).toBe(2);
    });

    it('uses a javelin as melee at range 1 without expending it', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      const javelin = equipWeapon(actor, 15, { meleeRange: 1, ammoType: 'self', stack: 3 });
      const target = makeTarget(10, 2, 1); // distance 1, melee

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(target.components.get('attributes').hp).toBe(8);
      expect(javelin.components.get('stackable').count).toBe(3); // melee does not consume
    });

    it('does not damage a target behind a wall, though the arrow is still spent', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      const arrows = equipArrows(actor, 5);
      const target = makeTarget(10, 4, 1);
      level.tiles[1][3] = 'wall'; // between actor (1,1) and target (4,1)

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(target.components.get('attributes').hp).toBe(10);
      expect(arrows.components.get('stackable').count).toBe(4);
    });

    it('is a free no-op for the player against a target beyond weapon range', () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 });
      registry.addComponent(actor, 'playerControlled', components.playerControlled());
      equipWeapon(actor, 2, { meleeRange: 1 }); // spear: range 2
      const target = makeTarget(10, 5, 1); // distance 4

      const free = executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(free).toBe(true);
      expect(target.components.get('attributes').hp).toBe(10);
    });

    it("consumes an NPC's turn against a target beyond weapon range", () => {
      const actor = makeRangedActor({ x: 1, y: 1, damage: 2 }); // no playerControlled
      equipWeapon(actor, 2, { meleeRange: 1 });
      const target = makeTarget(10, 5, 1); // distance 4

      expect(executeAttack(actor, { targetEntityId: target.id }, level, registry)).toBe(false);
    });
  });

  describe('attack animation', () => {
    it("flies a projectile with the ammo's directional sprite for an external-ammo weapon", () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      equipArrows(actor, 5, { E: 'arrow-e' });
      const target = makeTarget(10, 4, 1); // due east

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      const shots = animations.detached().filter((a) => a.kind === 'projectile');
      expect(shots).toHaveLength(1);
      expect(shots[0].renderable.sprite).toBe('arrow-e');
    });

    it("thrusts a reach weapon with the weapon's own directional sprite", () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 2, { meleeRange: 1, attackSprites: { E: 'spear-e' } });
      const target = makeTarget(10, 3, 1); // distance 2, due east

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      const thrusts = animations.detached().filter((a) => a.kind === 'thrust');
      expect(thrusts).toHaveLength(1);
      expect(thrusts[0].renderable.sprite).toBe('spear-e');
    });

    it('falls back to a wiggle (no detached projectile) when no attack sprite is defined', () => {
      const actor = makeRangedActor({ x: 1, y: 1 });
      equipWeapon(actor, 15, { meleeRange: 0, ammoType: 'arrow' });
      equipArrows(actor, 5); // no attack sprites
      const target = makeTarget(10, 4, 1);

      executeAttack(actor, { targetEntityId: target.id }, level, registry);

      expect(animations.detached()).toHaveLength(0);
    });
  });
});
