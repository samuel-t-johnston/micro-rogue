import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { Slots } from '../../../data/equipment-slots.js';
import { consumable } from '../../test-support/fixtures.js';
import {
  serializeEntities,
  deserializeEntities,
  serializeLevel,
  deserializeLevel,
  serializeComponent,
  deserializeComponent,
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

// The one guard that enforces the plain-JSON component invariant (see serialize.js / components.js):
// every component the registry can produce must survive the real save path — serialize + JSON +
// deserialize — structurally unchanged. A component holding a Set/Map/entity-ref/non-finite number
// with no codec would silently corrupt on save; here it fails loudly instead. The completeness test
// makes a newly-added component fail until its author supplies a sample, forcing them to exercise it.
describe('component-codec round-trip guard', () => {
  // Referenced entities for the ref-holding codecs (inventory/wearsEquipment), built via T1 fixtures.
  const reg = createEntityRegistry();
  const item1 = consumable(reg, { name: 'A' });
  const item2 = consumable(reg, { name: 'B' });
  const getEntity = (id) => reg.getEntity(id);

  const wears = components.wearsEquipment([Slots.WEAPON, Slots.ARMOR]);
  wears.slots[Slots.WEAPON] = item1; // one slot filled, one null

  const tp = components.tilePerception();
  tp.visible.add('1,2');
  tp.memory.set('1,2', 'floor');
  tp.rememberedEntities.set('3,4', [
    { sprite: 'door-closed', color: '#8B6F47', glyph: '+', glyphColor: '#c8a36a', layer: 0 },
  ]);

  // Representative data for every component — the shapes real saves carry; ref/collection components
  // use the entities and structures above. Keep alphabetized to match components.js.
  const SAMPLES = {
    ai: { ...components.ai(['chase-others', 'attack-in-range']), lastGoal: 'chase-others' },
    ammunition: components.ammunition('arrow', 0.5, { N: 'arrow-n' }),
    attacker: components.attacker(),
    attributeModifiers: components.attributeModifiers({ attack: 1, hp: 5 }),
    attributes: components.attributes({ hp: 10, str: 3 }),
    blocksMovement: components.blocksMovement(),
    consumable: components.consumable('heal', { amount: 10 }),
    container: components.container(),
    creature: components.creature(),
    decay: components.decay(5),
    dungeonExit: components.dungeonExit(),
    entityTypeId: components.entityTypeId('orc'),
    entryPoint: components.entryPoint(),
    equippable: components.equippable(Slots.WEAPON),
    faction: components.faction(['orcs']),
    hearing: components.hearing(5),
    inventory: components.inventory([item1, item2]),
    item: components.item({ type: 'inventory', ownerId: item1.id }),
    knownLanguages: components.knownLanguages(['orcish']),
    levelUp: components.levelUp({
      dynamic: true,
      points: 2,
      attributePercentages: { str: 1 },
      maxLevel: 25,
      lastLevel: 3,
    }),
    memory: components.memory({ autoMoveTarget: { x: 1, y: 2 }, enemyIds: [1, 2] }),
    name: components.name('Goblin'),
    noisyMovement: components.noisyMovement({
      chance: 0.5,
      volume: 3,
      message: { kind: 'scrabble' },
    }),
    opaque: components.opaque(),
    openable: components.openable('door-closed', 'door-open'),
    persistVisible: components.persistVisible(),
    playerControlled: components.playerControlled(),
    position: components.position(3, 4),
    questItem: components.questItem('amulet-of-yendor'),
    renderable: components.renderable('orc', '#101010', 'o', '#00ff00', 0),
    scentSource: components.scentSource({ profile: 'orcs', intensity: 3 }),
    senses: components.senses(['vision', 'hearing']),
    smell: components.smell(2),
    sound: components.sound({
      sourceId: item1.id,
      volume: 6,
      language: 'orcish',
      message: { kind: 'enemy-report', direction: 'NW' },
      sourceFactions: ['orcs'],
    }),
    stackable: components.stackable(100, 20),
    throwable: components.throwable('damage', { amount: 5 }, 1),
    tilePerception: tp,
    transition: components.transition(null, 'down'),
    turnTaker: components.turnTaker(1),
    vision: components.vision(8),
    voice: components.voice('orcish'),
    weapon: components.weapon(15, {
      meleeRange: 0,
      ammoType: 'arrow',
      attackSprites: { N: 'arrow-n' },
    }),
    wearsEquipment: wears,
  };

  it('has a sample for every component (add one when you add a component)', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(components).sort());
  });

  it.each(Object.keys(SAMPLES))('round-trips %s through serialize + JSON + deserialize', (name) => {
    const throughSave = JSON.parse(JSON.stringify(serializeComponent(name, SAMPLES[name])));
    expect(deserializeComponent(name, throughSave, getEntity)).toEqual(SAMPLES[name]);
  });
});
