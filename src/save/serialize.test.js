import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createLevel } from '../world/level.js';
import { components } from '../world/components.js';
import {
  serializeEntities,
  deserializeEntities,
  serializeLevel,
  deserializeLevel,
} from './serialize.js';

// Round-trips through JSON to prove the serialized form is genuinely JSON-safe (no Maps,
// Sets, or object refs sneaking through) and rehydrates into a fresh registry.
function rehydrate(registry) {
  const reg2 = createEntityRegistry();
  deserializeEntities(JSON.parse(JSON.stringify(serializeEntities(registry))), reg2);
  return reg2;
}

describe('entity reference codecs', () => {
  it('converts inventory and equipment refs to ids and back to the right instances', () => {
    const reg = createEntityRegistry();
    const owner = reg.createEntity();
    reg.addComponent(owner, 'inventory', components.inventory());
    reg.addComponent(owner, 'wearsEquipment', components.wearsEquipment(['weapon', 'armor']));
    const potion = reg.createEntity();
    reg.addComponent(potion, 'name', components.name('Potion'));
    const sword = reg.createEntity();
    reg.addComponent(sword, 'name', components.name('Sword'));

    owner.components.get('inventory').items.push(potion);
    owner.components.get('wearsEquipment').slots.weapon = sword; // armor stays null

    const serialized = serializeEntities(reg);
    const ownerS = serialized.find((e) => e.id === owner.id);
    expect(ownerS.components.inventory.items).toEqual([potion.id]);
    expect(ownerS.components.wearsEquipment.slots).toEqual({ weapon: sword.id, armor: null });

    const reg2 = createEntityRegistry();
    deserializeEntities(JSON.parse(JSON.stringify(serialized)), reg2);
    const owner2 = reg2.getEntity(owner.id);
    const slots2 = owner2.components.get('wearsEquipment').slots;

    expect(owner2.components.get('inventory').items[0]).toBe(reg2.getEntity(potion.id));
    expect(slots2.weapon).toBe(reg2.getEntity(sword.id));
    expect(slots2.armor).toBeNull();
  });
});

describe('tilePerception Set/Map codec', () => {
  it('round-trips visible Set and memory Map', () => {
    const reg = createEntityRegistry();
    const e = reg.createEntity();
    const tp = components.tilePerception();
    tp.visible.add('1,2');
    tp.visible.add('3,4');
    tp.memory.set('1,2', 'floor');
    tp.memory.set('5,5', 'wall');
    reg.addComponent(e, 'tilePerception', tp);

    const s = serializeEntities(reg)[0];
    expect(s.components.tilePerception.visible).toEqual(['1,2', '3,4']);
    expect(s.components.tilePerception.memory).toEqual([
      ['1,2', 'floor'],
      ['5,5', 'wall'],
    ]);

    const tp2 = rehydrate(reg).getEntity(e.id).components.get('tilePerception');
    expect(tp2.visible).toBeInstanceOf(Set);
    expect(tp2.visible.has('3,4')).toBe(true);
    expect(tp2.memory).toBeInstanceOf(Map);
    expect(tp2.memory.get('5,5')).toBe('wall');
  });

  it('round-trips the rememberedEntities Map of snapshots', () => {
    const reg = createEntityRegistry();
    const e = reg.createEntity();
    const tp = components.tilePerception();
    const snap = {
      sprite: { col: 16, row: 22 },
      color: '#8B6F47',
      glyph: '+',
      glyphColor: '#c8a36a',
      layer: 0,
    };
    tp.rememberedEntities.set('2,3', [snap]);
    reg.addComponent(e, 'tilePerception', tp);

    const s = serializeEntities(reg)[0];
    expect(s.components.tilePerception.rememberedEntities).toEqual([['2,3', [snap]]]);

    const tp2 = rehydrate(reg).getEntity(e.id).components.get('tilePerception');
    expect(tp2.rememberedEntities).toBeInstanceOf(Map);
    expect(tp2.rememberedEntities.get('2,3')).toEqual([snap]);
  });

  it('defaults rememberedEntities to an empty Map for older saves that lack it', () => {
    const reg = createEntityRegistry();
    const e = reg.createEntity();
    reg.addComponent(e, 'tilePerception', components.tilePerception());
    const s = serializeEntities(reg)[0];
    delete s.components.tilePerception.rememberedEntities; // simulate a pre-feature save

    const reg2 = createEntityRegistry();
    deserializeEntities(JSON.parse(JSON.stringify([s])), reg2);
    const tp2 = reg2.getEntity(e.id).components.get('tilePerception');
    expect(tp2.rememberedEntities).toBeInstanceOf(Map);
    expect(tp2.rememberedEntities.size).toBe(0);
  });
});

describe('level serialization', () => {
  it('round-trips tiles, overrides Map, blackboard, and re-places member entities', () => {
    const reg = createEntityRegistry();
    const level = createLevel();
    level.width = 3;
    level.height = 2;
    level.tiles = [
      ['floor', 'floor', 'wall'],
      ['wall', 'floor', 'floor'],
    ];
    level.overrides.set('2,1', 'pit');
    level.blackboard = { theme: 'dungeon' };
    const mob = reg.createEntity();
    reg.addComponent(mob, 'position', components.position(1, 1));
    level.placeEntity(mob);

    const ls = serializeLevel(level);
    expect(ls.overrides).toEqual([['2,1', 'pit']]);
    expect(ls.entityIds).toEqual([mob.id]);

    const reg2 = rehydrate(reg);
    const level2 = deserializeLevel(JSON.parse(JSON.stringify(ls)), reg2);
    const mob2 = reg2.getEntity(mob.id);

    expect(level2.getTile(0, 0)).toBe('floor');
    expect(level2.getTile(2, 1)).toBe('pit'); // override wins over base tile
    expect(level2.blackboard).toEqual({ theme: 'dungeon' });
    expect(level2.entities).toContain(mob2);
    // spatial index is rebuilt from positions, never serialized
    expect([...level2.getEntitiesAt(1, 1)]).toContain(mob2);
  });

  it('round-trips level identity (branch, depth, pipelineId, seed)', () => {
    const level = createLevel({ branch: 1, depth: 3, pipelineId: 'procedural-3x3', seed: 9999 });
    level.width = 1;
    level.height = 1;
    level.tiles = [['floor']];

    const ls = serializeLevel(level);
    expect(ls).toMatchObject({ branch: 1, depth: 3, pipelineId: 'procedural-3x3', seed: 9999 });

    const level2 = deserializeLevel(JSON.parse(JSON.stringify(ls)), createEntityRegistry());
    expect(level2.branch).toBe(1);
    expect(level2.depth).toBe(3);
    expect(level2.pipelineId).toBe('procedural-3x3');
    expect(level2.seed).toBe(9999);
  });
});
