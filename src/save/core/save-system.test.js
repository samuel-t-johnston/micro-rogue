import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rng } from '../../engine/core/rng.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createPlayer } from '../../world/entities/player.js';
import { createGoblin, createOrc } from '../../world/entities/creatures.js';
import { createBoulder, createChest, createDoor } from '../../world/entities/furniture.js';
import {
  createDagger,
  createHealingPotion,
  createPotionOfPain,
} from '../../world/entities/items.js';
import { Slots } from '../../../data/equipment-slots.js';
import { getPool, getScore } from '../../attributes/attribute-access.js';
import {
  serializeGame,
  deserializeGame,
  loadSave,
  migrations,
  SaveTooNewError,
  MigrationError,
  SAVE_VERSION,
  GAME_VERSION,
  writeSave,
  readSave,
  clearSave,
  hasSave,
  getSaveMeta,
  commitSave,
  loadSavedGame,
} from './save-system.js';
import saveV1 from '../fixtures/save-v1.json';
import saveV2 from '../fixtures/save-v2.json';
import saveV3 from '../fixtures/save-v3.json';
import saveV4 from '../fixtures/save-v4.json';
import saveV5 from '../fixtures/save-v5.json';
import saveV6 from '../fixtures/save-v6.json';
import saveV7 from '../fixtures/save-v7.json';
import saveV8 from '../fixtures/save-v8.json';
import saveV9 from '../fixtures/save-v9.json';

// Builds a realistic game directly (the pipeline's static stage does a dynamic file:// import
// that vitest's resolver mangles on Windows): a chest with contained items, creatures, map
// items, furniture, plus a player carrying an inventory item and an equipped weapon — enough
// to exercise every codec and the chest-contents drop-bug guard.
async function buildGame() {
  rng.init(12345);
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 12;
  level.height = 8;
  level.tiles = Array.from({ length: level.height }, (_, y) =>
    Array.from({ length: level.width }, (_, x) =>
      x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1 ? 'wall' : 'floor',
    ),
  );
  level.blackboard = { theme: 'test' };

  const cx = 6;
  const cy = 4;
  level.placeEntity(createBoulder(registry, cx + 2, cy));
  level.placeEntity(createDoor(registry, 5, 3));
  level.placeEntity(createHealingPotion(registry, cx - 2, cy));
  level.placeEntity(createDagger(registry, cx - 3, cy));
  const chest = createChest(registry, cx + 3, cy + 1);
  const chestInv = chest.components.get('inventory');
  chestInv.items.push(createHealingPotion(registry, null, null, chest.id));
  chestInv.items.push(createPotionOfPain(registry, null, null, chest.id));
  chestInv.items.push(createDagger(registry, null, null, chest.id));
  level.placeEntity(chest);
  level.placeEntity(createGoblin(registry, 3, 2));
  level.placeEntity(createOrc(registry, 8, 2));

  const player = await createPlayer(registry, cx, cy);
  level.placeEntity(player);

  const potion = createHealingPotion(registry, null, null, player.id);
  player.components.get('inventory').items.push(potion);

  const dagger = createDagger(registry, null, null, player.id);
  dagger.components.get('item').location = {
    type: 'equipped',
    ownerId: player.id,
    slot: Slots.WEAPON,
  };
  player.components.get('wearsEquipment').slots[Slots.WEAPON] = dagger;

  const mem = player.components.get('memory');
  mem.autoMoveTarget = { x: 3, y: 4 };
  mem.knownEnemyIds = registry
    .getEntitiesWith('ai')
    .filter((e) => e !== player)
    .map((e) => e.id);

  // Deterministic perception content (independent of FOV specifics) to assert Set/Map fidelity.
  const tp = player.components.get('tilePerception');
  tp.visible.add('99,99');
  tp.memory.set('99,99', 'floor');

  return { registry, level, player };
}

beforeEach(() => {
  localStorage.clear();
});

describe('serializeGame / deserializeGame round-trip', () => {
  it('survives JSON + migration and restores entities, level, refs, and RNG', async () => {
    const { registry, level, player } = await buildGame();
    rng.random(); // advance so saved state differs from the seed
    rng.random();

    const save = serializeGame({ registry, level, player, turnCount: 7 });
    const expectedRng = [rng.random(), rng.random()]; // continuation from the saved position

    const restored = deserializeGame(loadSave(JSON.parse(JSON.stringify(save))));

    expect(restored.turnCount).toBe(7);

    // RNG restored to its exact saved position -> deterministic continuation.
    expect(rng.random()).toBe(expectedRng[0]);
    expect(rng.random()).toBe(expectedRng[1]);

    const p = restored.player;
    expect(p.id).toBe(player.id);
    expect(p.components.get('attributes')).toEqual(player.components.get('attributes'));
    expect(p.components.get('position')).toEqual(player.components.get('position'));

    // Inventory + equipment rehydrate to the correct instances in the new registry.
    const inv = p.components.get('inventory').items;
    expect(inv).toHaveLength(1);
    expect(inv[0]).toBe(restored.registry.getEntity(inv[0].id));
    expect(inv[0].components.get('name')).toBe('Healing Potion');

    const weapon = p.components.get('wearsEquipment').slots[Slots.WEAPON];
    expect(weapon).toBe(restored.registry.getEntity(weapon.id));
    expect(weapon.components.get('name')).toBe('Dagger');

    // tilePerception keeps its runtime Set/Map types and contents.
    const tp = p.components.get('tilePerception');
    expect(tp.visible).toBeInstanceOf(Set);
    expect(tp.visible.has('99,99')).toBe(true);
    expect(tp.memory).toBeInstanceOf(Map);
    expect(tp.memory.get('99,99')).toBe('floor');

    // Goal memory (plain JSON, id-based) round-trips via the default codec.
    expect(p.components.get('memory').autoMoveTarget).toEqual({ x: 3, y: 4 });
    expect(Array.isArray(p.components.get('memory').knownEnemyIds)).toBe(true);

    // Chest contents survive — items live only in the registry, referenced by ids.
    const chest = restored.registry.getAllEntities().find((e) => e.components.has('container'));
    const chestItems = chest.components.get('inventory').items;
    expect(chestItems).toHaveLength(3);
    for (const item of chestItems) {
      expect(item).toBe(restored.registry.getEntity(item.id));
      expect(item.components.get('item').location.containerId).toBe(chest.id);
    }

    // Level rebuilt: tiles match and the spatial index re-places the player.
    const ppos = p.components.get('position');
    expect(restored.level.width).toBe(level.width);
    expect(restored.level.getTile(0, 0)).toBe(level.getTile(0, 0));
    expect([...restored.level.getEntitiesAt(ppos.x, ppos.y)]).toContain(p);
  });

  it('restores the id counter beyond every loaded entity', async () => {
    const { registry, level, player } = await buildGame();
    const save = serializeGame({ registry, level, player, turnCount: 1 });
    const restored = deserializeGame(JSON.parse(JSON.stringify(save)));

    const maxId = Math.max(...restored.registry.getAllEntities().map((e) => e.id));
    expect(restored.registry.getNextId()).toBe(registry.getNextId());
    expect(restored.registry.getNextId()).toBeGreaterThan(maxId);
  });

  it('round-trips the current node id and frozen floors (model b)', async () => {
    const { registry, level, player } = await buildGame();
    // A frozen floor is an opaque already-serialized blob; the save carries it through verbatim.
    const frozenLevels = {
      'floor-1': { level: { width: 3, height: 3, tiles: [], entityIds: [] }, entities: [] },
    };
    const save = serializeGame({
      registry,
      level,
      player,
      turnCount: 3,
      currentNodeId: 'floor-2',
      frozenLevels,
    });

    const restored = deserializeGame(JSON.parse(JSON.stringify(save)));
    expect(restored.currentNodeId).toBe('floor-2');
    expect(restored.frozenLevels).toEqual(frozenLevels);
    // The active floor's entities are the only ones in the live registry.
    expect(restored.registry.getEntity(player.id)).not.toBeNull();
  });
});

describe('loadSave migration runner', () => {
  // These tests push stub migrations; snapshot and restore the real chain around each so the
  // shipped migrations (and other tests) are unaffected.
  let realMigrations;
  beforeEach(() => {
    realMigrations = migrations.slice();
  });
  afterEach(() => {
    migrations.length = 0;
    migrations.push(...realMigrations);
  });

  it('throws SaveTooNewError for a save from a newer schema', () => {
    expect(() => loadSave({ saveVersion: SAVE_VERSION + 1 })).toThrow(SaveTooNewError);
  });

  it('passes through a clone unchanged when no migrations apply', () => {
    const raw = { saveVersion: SAVE_VERSION, versionHistory: [{ saveVersion: SAVE_VERSION }] };
    const out = loadSave(raw);
    expect(out).not.toBe(raw);
    expect(out.saveVersion).toBe(SAVE_VERSION);
    expect(out.versionHistory).toHaveLength(1);
  });

  it('runs an applicable migration and appends version history', () => {
    migrations.push({
      from: SAVE_VERSION,
      to: SAVE_VERSION + 1,
      migrate: (s) => {
        s.migrated = true;
        return s;
      },
    });
    const out = loadSave({ saveVersion: SAVE_VERSION, versionHistory: [] });
    expect(out.migrated).toBe(true);
    expect(out.saveVersion).toBe(SAVE_VERSION + 1);
    expect(out.versionHistory).toHaveLength(1);
    expect(out.versionHistory[0].saveVersion).toBe(SAVE_VERSION + 1);
  });

  it('wraps a throwing migration in MigrationError naming the failed step', () => {
    migrations.push({
      from: SAVE_VERSION,
      to: SAVE_VERSION + 1,
      migrate: () => {
        throw new Error('boom');
      },
    });
    try {
      loadSave({ saveVersion: SAVE_VERSION, versionHistory: [] });
      expect.unreachable('loadSave should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationError);
      expect(err.from).toBe(SAVE_VERSION);
      expect(err.to).toBe(SAVE_VERSION + 1);
    }
  });
});

describe('v1 → … migration chain (real, from a fixture)', () => {
  it('lifts meta.rngState into meta.streams.gameplay (the v1→v2 step) and runs to current', () => {
    const migrated = loadSave(saveV1);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.meta.streams).toEqual({ gameplay: saveV1.meta.rngState });
    expect(migrated.meta.rngState).toBeUndefined();
    expect(migrated.meta.seed).toBe(saveV1.meta.seed);
    // One history entry per migration step on top of the original.
    expect(migrated.versionHistory).toHaveLength(SAVE_VERSION);
    expect(migrated.versionHistory[1].saveVersion).toBe(2);
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV1);
    expect(saveV1.saveVersion).toBe(1);
    expect(saveV1.meta.rngState).toBe(987654321);
  });

  it('a migrated v1 save deserializes into a live game', () => {
    const restored = deserializeGame(loadSave(saveV1));
    expect(restored.player.id).toBe(saveV1.playerId);
    expect(restored.turnCount).toBe(saveV1.meta.turnCount);
    // health {18,20} folded to the hp pool + con by v7→v8; v9→v10 seeds hpBase from con.
    expect(restored.player.components.get('attributes')).toEqual({ hp: 18, con: 20, hpBase: 20 });
    expect(rng.getMasterSeed()).toBe(saveV1.meta.seed);
  });
});

describe('v2 → v3 migration (real, from a fixture)', () => {
  it('adds the start node id and an empty frozen-levels map', () => {
    const migrated = loadSave(saveV2);
    // loadSave runs the full chain to the current version; the v2→v3 effects still hold.
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(migrated.currentNodeId).toBe('floor-1');
    expect(migrated.frozenLevels).toEqual({});
    // The v2 stream envelope is untouched.
    expect(migrated.meta.streams).toEqual(saveV2.meta.streams);
  });

  it('a migrated v2 save deserializes into a live game positioned at the start floor', () => {
    const restored = deserializeGame(loadSave(saveV2));
    expect(restored.currentNodeId).toBe('floor-1');
    expect(restored.frozenLevels).toEqual({});
    expect(restored.player.id).toBe(saveV2.playerId);
  });
});

describe('v3 → v4 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('gives every turnTaker entity a creature marker', () => {
    const migrated = loadSave(saveV3);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    // Player (id 1) and orc (id 2) are turnTakers → now creatures.
    expect(findEntity(migrated.entities, 1).components.creature).toEqual({});
    expect(findEntity(migrated.entities, 2).components.creature).toEqual({});
  });

  it('does not mark a non-turnTaker (a floor item) as a creature', () => {
    const migrated = loadSave(saveV3);
    expect(findEntity(migrated.entities, 3).components.creature).toBeUndefined();
  });

  it('also migrates turnTakers inside frozen floors', () => {
    const migrated = loadSave(saveV3);
    const frozenGoblin = findEntity(migrated.frozenLevels['floor-2'].entities, 4);
    expect(frozenGoblin.components.creature).toEqual({});
  });

  it('a migrated v3 save deserializes into a live game', () => {
    const restored = deserializeGame(loadSave(saveV3));
    expect(restored.player.id).toBe(saveV3.playerId);
    expect(restored.player.components.has('creature')).toBe(true);
  });
});

describe('v4 → v5 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('converts known sprite coordinates to catalog names', () => {
    const migrated = loadSave(saveV4);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    expect(findEntity(migrated.entities, 3).components.renderable.sprite).toBe('healing-potion');
  });

  it('converts an openable door’s closed/open sprites to names', () => {
    const door = findEntity(loadSave(saveV4).entities, 2);
    expect(door.components.renderable.sprite).toBe('door-closed');
    expect(door.components.openable.closedSprite).toBe('door-closed');
    expect(door.components.openable.openSprite).toBe('door-open');
  });

  it('leaves a glyph-only renderable (sprite null) as null', () => {
    expect(findEntity(loadSave(saveV4).entities, 1).components.renderable.sprite).toBeNull();
  });

  it('maps an unknown coordinate to null (renderer falls back to the glyph)', () => {
    const mystery = findEntity(loadSave(saveV4).frozenLevels['floor-2'].entities, 4);
    expect(mystery.components.renderable.sprite).toBeNull();
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV4);
    expect(saveV4.entities[2].components.renderable.sprite).toEqual({ col: 16, row: 16 });
  });

  it('a migrated v4 save deserializes into a live game', () => {
    const restored = deserializeGame(loadSave(saveV4));
    expect(restored.player.id).toBe(saveV4.playerId);
    expect(restored.player.components.get('renderable').sprite).toBeNull();
  });
});

describe('v5 → v6 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('backfills throwable on a potion that predates the throw action', () => {
    const migrated = loadSave(saveV5);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    // Healing Potion (id 3) gets the canonical thrown splash: heal 5, always shatters.
    expect(findEntity(migrated.entities, 3).components.throwable).toEqual({
      effectType: 'heal',
      params: { amount: 5 },
      breakChance: 1,
    });
  });

  it('leaves a non-potion item (a dagger) without a throwable component', () => {
    const migrated = loadSave(saveV5);
    expect(findEntity(migrated.entities, 2).components.throwable).toBeUndefined();
  });

  it('also backfills potions inside frozen floors', () => {
    const frozenPotion = findEntity(loadSave(saveV5).frozenLevels['floor-2'].entities, 4);
    expect(frozenPotion.components.throwable).toEqual({
      effectType: 'damage',
      params: { amount: 5 },
      breakChance: 1,
    });
  });

  it('does not overwrite a throwable that already exists', () => {
    const raw = {
      saveVersion: 5,
      versionHistory: [{ saveVersion: 5 }],
      entities: [
        {
          id: 1,
          components: {
            name: 'Healing Potion',
            throwable: { effectType: 'heal', params: { amount: 99 }, breakChance: 0 },
          },
        },
      ],
    };
    const migrated = loadSave(raw);
    expect(migrated.entities[0].components.throwable.params.amount).toBe(99);
    expect(migrated.entities[0].components.throwable.breakChance).toBe(0);
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV5);
    expect(saveV5.entities[2].components.throwable).toBeUndefined();
  });

  it('a migrated v5 save deserializes into a live game', () => {
    const restored = deserializeGame(loadSave(saveV5));
    expect(restored.player.id).toBe(saveV5.playerId);
    const potion = restored.registry
      .getAllEntities()
      .find((e) => e.components.get('name') === 'Healing Potion');
    expect(potion.components.has('throwable')).toBe(true);
  });
});

describe('v6 → v7 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('backfills a range-1 melee weapon component on a weapon-slot item that predates it', () => {
    const migrated = loadSave(saveV6);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    // Dagger (id 2) had only equippable(weapon); it becomes a melee weapon.
    expect(findEntity(migrated.entities, 2).components.weapon).toEqual({
      range: 1,
      meleeRange: 1,
      ammoType: null,
      breakChance: 0,
      attackSprites: {},
    });
  });

  it('does not give a non-weapon-slot equippable (armor) a weapon component', () => {
    const migrated = loadSave(saveV6);
    expect(findEntity(migrated.entities, 3).components.weapon).toBeUndefined();
  });

  it('adds an empty ammunition slot to a weapon+armor loadout', () => {
    const player = findEntity(loadSave(saveV6).entities, 1);
    expect(player.components.wearsEquipment.slots).toEqual({
      weapon: 2,
      armor: 3,
      ammunition: null,
    });
  });

  it('also backfills weapon components inside frozen floors', () => {
    const sword = findEntity(loadSave(saveV6).frozenLevels['floor-2'].entities, 5);
    expect(sword.components.weapon).toMatchObject({ range: 1, ammoType: null });
  });

  it('does not overwrite an existing weapon component or ammunition slot', () => {
    const raw = {
      saveVersion: 6,
      versionHistory: [{ saveVersion: 6 }],
      entities: [
        {
          id: 1,
          components: {
            equippable: { slot: 'weapon' },
            weapon: {
              range: 9,
              meleeRange: 0,
              ammoType: 'arrow',
              breakChance: 0,
              attackSprites: {},
            },
          },
        },
        {
          id: 2,
          components: {
            wearsEquipment: { slots: { weapon: null, armor: null, ammunition: 7 } },
          },
        },
      ],
    };
    const migrated = loadSave(raw);
    expect(migrated.entities[0].components.weapon.range).toBe(9);
    expect(migrated.entities[1].components.wearsEquipment.slots.ammunition).toBe(7);
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV6);
    expect(saveV6.entities[1].components.weapon).toBeUndefined();
    expect(saveV6.entities[0].components.wearsEquipment.slots.ammunition).toBeUndefined();
  });

  it('a migrated v6 save deserializes into a live game with a quiver and a real weapon', () => {
    const restored = deserializeGame(loadSave(saveV6));
    expect(restored.player.id).toBe(saveV6.playerId);
    expect(Slots.AMMUNITION in restored.player.components.get('wearsEquipment').slots).toBe(true);
    const dagger = restored.player.components.get('wearsEquipment').slots[Slots.WEAPON];
    expect(dagger.components.get('weapon').range).toBe(1);
  });
});

describe('v7 → v8 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('folds health into the hp pool + con, and removes the health component', () => {
    const player = findEntity(loadSave(saveV7).entities, 1).components;
    expect(player.health).toBeUndefined();
    // health {current: 18, max: 20} -> hp 18, con 20 (maxHP = con preserves the old max).
    expect(player.attributes).toMatchObject({ hp: 18, con: 20 });
  });

  it('folds attacker.damage into the attack score, keeping attacker as a bare marker', () => {
    const player = findEntity(loadSave(saveV7).entities, 1).components;
    expect(player.attributes.attack).toBe(1);
    expect(player.attacker).toEqual({});
  });

  it('renames item attributeModifiers keys to the new attribute names', () => {
    const entities = loadSave(saveV7).entities;
    expect(findEntity(entities, 2).components.attributeModifiers).toEqual({ attack: 1 }); // dagger
    expect(findEntity(entities, 3).components.attributeModifiers).toEqual({ hp: 5 }); // leather armor
  });

  it('leaves an entity without health or attacker untouched', () => {
    const potion = findEntity(loadSave(saveV7).entities, 4).components;
    expect(potion.attributes).toBeUndefined();
  });

  it('also folds entities inside frozen floors', () => {
    const goblin = findEntity(loadSave(saveV7).frozenLevels['floor-2'].entities, 5).components;
    expect(goblin.health).toBeUndefined();
    expect(goblin.attributes).toMatchObject({ hp: 3, con: 5, attack: 1 });
    expect(goblin.attacker).toEqual({});
  });

  it('merges into a pre-existing attributes component rather than replacing it', () => {
    const raw = {
      saveVersion: 7,
      versionHistory: [{ saveVersion: 7 }],
      entities: [
        {
          id: 1,
          components: {
            attributes: { str: 14 },
            health: { current: 4, max: 6 },
          },
        },
      ],
    };
    // loadSave runs the full chain: v7→v8 folds health, v9→v10 seeds hpBase from con.
    expect(loadSave(raw).entities[0].components.attributes).toEqual({
      str: 14,
      hp: 4,
      con: 6,
      hpBase: 6,
    });
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV7);
    expect(saveV7.entities[0].components.health).toEqual({ current: 18, max: 20 });
    expect(saveV7.entities[1].components.attributeModifiers).toEqual({ attackDamage: 1 });
  });

  it('a migrated v7 save deserializes into a live game with a working hp pool', () => {
    const restored = deserializeGame(loadSave(saveV7));
    expect(restored.player.id).toBe(saveV7.playerId);
    // max = hpBase 20 (seeded from con by v9→v10) + armor hp 5 + 2·con 40.
    expect(getPool(restored.player, 'hp')).toEqual({ current: 18, max: 65 });
    expect(getScore(restored.player, 'attack')).toBe(2); // unarmed 1 + dagger 1
  });
});

describe('v8 → v9 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('seeds the spd base from turnTaker.speed, overwriting the old inert placeholder scale', () => {
    const migrated = loadSave(saveV8);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    // Player stored spd 10 (old scale) but turnTaker.speed 1 — the real cadence wins.
    expect(findEntity(migrated.entities, 1).components.attributes.spd).toBe(1);
  });

  it('also seeds spd inside frozen floors', () => {
    const goblin = findEntity(loadSave(saveV8).frozenLevels['floor-2'].entities, 5);
    expect(goblin.components.attributes.spd).toBe(1); // was 11, turnTaker.speed 1
  });

  it('leaves a turnTaker that has no attributes untouched (keeps its literal speed)', () => {
    const raw = {
      saveVersion: 8,
      versionHistory: [{ saveVersion: 8 }],
      entities: [{ id: 1, components: { turnTaker: { speed: 1.4, accumulator: 0 } } }],
    };
    const migrated = loadSave(raw);
    expect(migrated.entities[0].components.attributes).toBeUndefined();
    expect(migrated.entities[0].components.turnTaker.speed).toBe(1.4);
  });

  it('leaves attributes on an entity with no turnTaker untouched', () => {
    const raw = {
      saveVersion: 8,
      versionHistory: [{ saveVersion: 8 }],
      entities: [{ id: 1, components: { attributes: { str: 5, spd: 10 } } }],
    };
    expect(loadSave(raw).entities[0].components.attributes).toEqual({ str: 5, spd: 10 });
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV8);
    expect(saveV8.entities[0].components.attributes.spd).toBe(10);
  });

  it('a migrated v8 save deserializes into a live game whose speed derives from spd + dex', () => {
    const restored = deserializeGame(loadSave(saveV8));
    expect(restored.player.id).toBe(saveV8.playerId);
    // spd base 1 (from turnTaker.speed) + 0.01 * dex 12 = 1.12.
    expect(getScore(restored.player, 'spd')).toBeCloseTo(1.12);
  });
});

describe('v9 → v10 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('seeds hpBase from con so the pool base survives the current/base split', () => {
    const migrated = loadSave(saveV9);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    const player = findEntity(migrated.entities, 1).components.attributes;
    expect(player.hpBase).toBe(20); // from con 20
    expect(player.hp).toBe(18); // stored current untouched
  });

  it('also seeds hpBase inside frozen floors', () => {
    const goblin = findEntity(loadSave(saveV9).frozenLevels['floor-2'].entities, 5);
    expect(goblin.components.attributes.hpBase).toBe(5); // from con 5
  });

  it('leaves an entity without attributes untouched', () => {
    const potion = findEntity(loadSave(saveV9).entities, 4).components;
    expect(potion.attributes).toBeUndefined();
  });

  it('does not overwrite an hpBase that already exists', () => {
    const raw = {
      saveVersion: 9,
      versionHistory: [{ saveVersion: 9 }],
      entities: [{ id: 1, components: { attributes: { con: 5, hp: 3, hpBase: 99 } } }],
    };
    expect(loadSave(raw).entities[0].components.attributes.hpBase).toBe(99);
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV9);
    expect(saveV9.entities[0].components.attributes.hpBase).toBeUndefined();
  });

  it('a migrated v9 save deserializes into a live game with base + con + equipment HP', () => {
    const restored = deserializeGame(loadSave(saveV9));
    expect(restored.player.id).toBe(saveV9.playerId);
    // max = hpBase 20 + armor hp 5 + 2·con 40 = 65; current 18 preserved.
    expect(getPool(restored.player, 'hp')).toEqual({ current: 18, max: 65 });
    // mp has no authored base: max = 2·int 20, absent current reads full.
    expect(getPool(restored.player, 'mp')).toEqual({ current: 20, max: 20 });
  });
});

describe('v10 → v11 migration (real, from a fixture)', () => {
  const findEntity = (entities, id) => entities.find((e) => e.id === id);

  it('grants the player a dynamic levelUp component with the default spec', () => {
    const migrated = loadSave(saveV9);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    const levelUp = findEntity(migrated.entities, 1).components.levelUp;
    expect(levelUp).toEqual({
      dynamic: true,
      points: 1,
      attributePercentages: { str: 0.33, dex: 0.33, con: 0.33, int: 0 },
      maxLevel: 25,
      lastLevel: 1, // player xp 0 → level 1; no retroactive allocation
    });
  });

  it('seeds lastLevel from the player’s current level so no points are back-paid', () => {
    const raw = {
      saveVersion: 10,
      versionHistory: [{ saveVersion: 10 }],
      entities: [
        { id: 1, components: { playerControlled: {}, attributes: { str: 5, xp: 30 } } }, // xp 30 → level 3
      ],
    };
    expect(loadSave(raw).entities[0].components.levelUp.lastLevel).toBe(3);
  });

  it('leaves a non-player entity without a levelUp component', () => {
    const goblin = findEntity(loadSave(saveV9).frozenLevels['floor-2'].entities, 5);
    expect(goblin.components.levelUp).toBeUndefined();
  });

  it('does not overwrite a levelUp component that already exists', () => {
    const raw = {
      saveVersion: 10,
      versionHistory: [{ saveVersion: 10 }],
      entities: [
        {
          id: 1,
          components: { playerControlled: {}, attributes: { xp: 0 }, levelUp: { dynamic: false } },
        },
      ],
    };
    expect(loadSave(raw).entities[0].components.levelUp).toEqual({ dynamic: false });
  });

  it('does not mutate the source fixture', () => {
    loadSave(saveV9);
    expect(saveV9.entities[0].components.levelUp).toBeUndefined();
  });
});

describe('commitSave / loadSavedGame orchestration', () => {
  it('returns null when there is no save', () => {
    expect(loadSavedGame()).toBeNull();
  });

  it('commits a live game and loads it straight back through localStorage', async () => {
    const { registry, level, player } = await buildGame();
    commitSave({ registry, level, player, turnCount: 9 });

    expect(hasSave()).toBe(true);
    const restored = loadSavedGame();
    expect(restored.turnCount).toBe(9);
    expect(restored.player.id).toBe(player.id);
    expect(restored.player.components.get('attributes')).toEqual(
      player.components.get('attributes'),
    );
    expect(restored.level.getTile(0, 0)).toBe(level.getTile(0, 0));
  });
});

describe('localStorage helpers', () => {
  it('writes, reports, reads back, and clears the save slot', async () => {
    const { registry, level, player } = await buildGame();
    const save = serializeGame({ registry, level, player, turnCount: 12 });

    expect(hasSave()).toBe(false);
    writeSave(save);
    expect(hasSave()).toBe(true);
    expect(readSave()).toEqual(save);
    expect(getSaveMeta()).toEqual({
      savedAt: save.savedAt,
      turnCount: 12,
      gameVersion: GAME_VERSION,
    });

    clearSave();
    expect(hasSave()).toBe(false);
    expect(readSave()).toBeNull();
    expect(getSaveMeta()).toBeNull();
  });
});
