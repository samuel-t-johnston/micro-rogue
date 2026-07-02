// Verifies the player-facing and debug log lines emitted by the action handlers.
// The event log is an ambient singleton (src/engine/log/game-log.js), so each test resets
// it and asserts against gameLog.getAll() rather than injecting a spy.
import { describe, it, expect, beforeEach } from 'vitest';
import { gameLog } from '../../engine/log/game-log.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { createDagger, createHealingPotion } from '../../world/entities/items.js';
import { createChest, createDoor } from '../../world/entities/furniture.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';
import { executePickup } from '../action-types/action-pickup.js';
import { executeDrop } from '../action-types/action-drop.js';
import { executeEquip } from '../action-types/action-equip.js';
import { executeUnequip } from '../action-types/action-unequip.js';
import { executeMove } from '../action-types/action-move.js';
import { executeAttack } from '../action-types/action-attack.js';
import { executeInteract } from '../action-types/action-interact.js';
import { executeSelfInteract } from '../action-types/action-self-interact.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

function displays() {
  return gameLog.getDisplayEntries(50).map((e) => e.display);
}

describe('action logging', () => {
  let registry, level;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
  });

  function makePlayer(x = 2, y = 2) {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Player'));
    registry.addComponent(e, 'playerControlled', components.playerControlled());
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'inventory', components.inventory());
    registry.addComponent(e, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
    registry.addComponent(e, 'attributes', components.attributes({ attack: 1 }));
    registry.addComponent(e, 'attacker', components.attacker());
    level.placeEntity(e);
    return e;
  }

  function makeGoblin(x = 3, y = 2, hp = 5) {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Goblin'));
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'attributes', components.attributes({ hp, con: hp, attack: 1 }));
    registry.addComponent(e, 'attacker', components.attacker());
    level.placeEntity(e);
    return e;
  }

  it('logs player pickup in second person', () => {
    const player = makePlayer();
    const dagger = createDagger(registry, 2, 2);
    level.placeEntity(dagger);

    executePickup(player, { itemEntityId: dagger.id }, level, registry);

    expect(displays()).toContain('You pick up the dagger.');
  });

  it('logs an NPC pickup in third person', () => {
    const goblin = makeGoblin();
    registry.addComponent(goblin, 'inventory', components.inventory());
    const dagger = createDagger(registry, 3, 2);
    level.placeEntity(dagger);

    executePickup(goblin, { itemEntityId: dagger.id }, level, registry);

    expect(displays()).toContain('The Goblin picks up the dagger.');
  });

  it('logs drop, equip and unequip for the player', () => {
    const player = makePlayer();
    const dagger = createDagger(registry, null, null, player.id);
    player.components.get('inventory').items.push(dagger);

    executeEquip(player, { itemEntityId: dagger.id }, level, registry);
    executeUnequip(player, { slot: Slots.WEAPON }, level, registry);
    executeDrop(player, { itemEntityId: dagger.id }, level, registry);

    expect(displays()).toEqual([
      'You equip the dagger.',
      'You unequip the dagger.',
      'You drop the dagger.',
    ]);
  });

  it('logs the displaced item as an unequip when equipping into an occupied slot', () => {
    const player = makePlayer();
    const oldDagger = createDagger(registry, null, null, player.id);
    const newDagger = createDagger(registry, null, null, player.id);
    player.components.get('wearsEquipment').slots[Slots.WEAPON] = oldDagger;
    oldDagger.components.get('item').location = {
      type: 'equipped',
      ownerId: player.id,
      slot: Slots.WEAPON,
    };
    player.components.get('inventory').items.push(newDagger);

    executeEquip(player, { itemEntityId: newDagger.id }, level, registry);

    expect(displays()).toEqual(['You unequip the dagger.', 'You equip the dagger.']);
  });

  it('logs a door interact as a debug entry with no display string', async () => {
    const player = makePlayer(2, 2);
    const door = createDoor(registry, 2, 3);
    level.placeEntity(door);

    await executeInteract(player, { targetEntityId: door.id }, level, registry);

    const interact = gameLog.getAll().find((e) => e.action === 'interact');
    expect(interact).toMatchObject({ interaction: 'door', opened: true });
    expect(interact.display).toBeUndefined();
    expect(displays()).toEqual([]); // never surfaces to the player
  });

  it('logs a debug interact plus a player-facing line per item taken from a chest', async () => {
    const player = makePlayer(2, 2);
    const chest = createChest(registry, 2, 3);
    const dagger = createDagger(registry, null, null, chest.id);
    const potion = createHealingPotion(registry, null, null, chest.id);
    chest.components.get('inventory').items.push(dagger, potion);
    level.placeEntity(chest);

    // Player confirms taking both items.
    const dialogController = {
      showItemList: async () => ({ confirmed: true, taken: [dagger, potion] }),
    };

    await executeInteract(player, { targetEntityId: chest.id }, level, registry, dialogController);

    // The interaction itself is debug-only...
    const interact = gameLog.getAll().find((e) => e.action === 'interact');
    expect(interact).toMatchObject({ interaction: 'container' });
    expect(interact.display).toBeUndefined();

    // ...while each item taken surfaces to the player.
    expect(displays()).toEqual(['You take the dagger.', 'You take the healing potion.']);
  });

  it('logs a player-facing pickup line per item taken from the floor', async () => {
    const player = makePlayer(2, 2);
    const dagger = createDagger(registry, 2, 2);
    const potion = createHealingPotion(registry, 2, 2);
    level.placeEntity(dagger);
    level.placeEntity(potion);

    // Multiple items on the tile → floor dialog; player confirms taking both.
    const dialogController = {
      showItemList: async () => ({ confirmed: true, taken: [dagger, potion] }),
    };

    await executeSelfInteract(player, {}, level, registry, dialogController);

    expect(displays()).toEqual(['You pick up the dagger.', 'You pick up the healing potion.']);
  });

  it('logs only the debug interact when a chest dialog is cancelled', async () => {
    const player = makePlayer(2, 2);
    const chest = createChest(registry, 2, 3);
    const dagger = createDagger(registry, null, null, chest.id);
    chest.components.get('inventory').items.push(dagger);
    level.placeEntity(chest);

    const dialogController = {
      showItemList: async () => ({ confirmed: false, taken: [] }),
    };

    await executeInteract(player, { targetEntityId: chest.id }, level, registry, dialogController);

    expect(gameLog.getAll().find((e) => e.action === 'interact')).toMatchObject({
      interaction: 'container',
    });
    expect(displays()).toEqual([]); // nothing taken → no player-facing line
  });

  it('logs a move as a debug entry with no display string', () => {
    const player = makePlayer(2, 2);
    executeMove(player, { x: 3, y: 2 }, level);

    const move = gameLog.getAll().find((e) => e.action === 'move');
    expect(move).toMatchObject({ from: { x: 2, y: 2 }, to: { x: 3, y: 2 } });
    expect(move.display).toBeUndefined();
    expect(displays()).toEqual([]); // never surfaces to the player
  });

  it('logs an attack with damage, and a separate death line, with correct pronouns', () => {
    const player = makePlayer(2, 2);
    const goblin = makeGoblin(3, 2, 1); // dies in one hit

    executeAttack(player, { targetEntityId: goblin.id }, level, registry);

    expect(displays()).toEqual(['You hit the Goblin for 1 damage.', 'The Goblin dies.']);
  });

  it('logs player death in second person when an NPC lands the killing blow', () => {
    const goblin = makeGoblin(3, 2);
    const player = makePlayer(2, 2);
    Object.assign(player.components.get('attributes'), { hp: 1, con: 1 }); // one hit is lethal

    executeAttack(goblin, { targetEntityId: player.id }, level, registry);

    expect(displays()).toContain('The Goblin hits you for 1 damage.');
    expect(displays()).toContain('You die.');
  });
});
