import { describe, it, expect, beforeEach } from 'vitest';
import { rng } from '../engine/rng.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createLevel } from '../world/level.js';
import { createPlayer } from '../world/player.js';
import { createGoblin, createOrc } from '../world/creatures.js';
import { createBoulder, createChest, createDoor } from '../world/furniture.js';
import { createDagger, createHealingPotion, createPotionOfPain } from '../world/items.js';
import { Slots } from '../../data/equipment-slots.js';
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
      (x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1) ? 'wall' : 'floor'));
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
  dagger.components.get('item').location = { type: 'equipped', ownerId: player.id, slot: Slots.WEAPON };
  player.components.get('wearsEquipment').slots[Slots.WEAPON] = dagger;

  const mem = player.components.get('memory');
  mem.autoMoveTarget = { x: 3, y: 4 };
  mem.knownEnemyIds = registry.getEntitiesWith('ai').filter(e => e !== player).map(e => e.id);

  // Deterministic perception content (independent of FOV specifics) to assert Set/Map fidelity.
  const tp = player.components.get('tilePerception');
  tp.visible.add('99,99');
  tp.memory.set('99,99', 'floor');

  return { registry, level, player };
}

beforeEach(() => {
  migrations.length = 0; // the real chain is empty at v1; keep it clean between tests
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
    expect(p.components.get('health')).toEqual(player.components.get('health'));
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
    const chest = restored.registry.getAllEntities().find(e => e.components.has('container'));
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

    const maxId = Math.max(...restored.registry.getAllEntities().map(e => e.id));
    expect(restored.registry.getNextId()).toBe(registry.getNextId());
    expect(restored.registry.getNextId()).toBeGreaterThan(maxId);
  });
});

describe('loadSave migration runner', () => {
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
      migrate: (s) => { s.migrated = true; return s; },
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
      migrate: () => { throw new Error('boom'); },
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
    expect(restored.player.components.get('health')).toEqual(player.components.get('health'));
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
