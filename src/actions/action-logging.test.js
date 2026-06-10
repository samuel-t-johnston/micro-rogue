// Verifies the player-facing and debug log lines emitted by the action handlers.
// The event log is an ambient singleton (src/engine/game-log.js), so each test resets
// it and asserts against gameLog.getAll() rather than injecting a spy.
import { describe, it, expect, beforeEach } from 'vitest';
import { gameLog } from '../engine/game-log.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createLevel } from '../world/level.js';
import { components } from '../world/components.js';
import { createDagger } from '../world/items.js';
import { Slots, HUMANOID_SLOTS } from '../../data/equipment-slots.js';
import { executePickup } from './action-types/action-pickup.js';
import { executeDrop } from './action-types/action-drop.js';
import { executeEquip } from './action-types/action-equip.js';
import { executeUnequip } from './action-types/action-unequip.js';
import { executeMove } from './action-types/action-move.js';
import { executeAttack } from './action-types/action-attack.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

function displays() {
  return gameLog.getDisplayEntries(50).map(e => e.display);
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
    registry.addComponent(e, 'attacker', components.attacker(1));
    level.placeEntity(e);
    return e;
  }

  function makeGoblin(x = 3, y = 2, hp = 5) {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Goblin'));
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'health', components.health(hp, hp));
    registry.addComponent(e, 'attacker', components.attacker(1));
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
    oldDagger.components.get('item').location = { type: 'equipped', ownerId: player.id, slot: Slots.WEAPON };
    player.components.get('inventory').items.push(newDagger);

    executeEquip(player, { itemEntityId: newDagger.id }, level, registry);

    expect(displays()).toEqual([
      'You unequip the dagger.',
      'You equip the dagger.',
    ]);
  });

  it('logs a move as a debug entry with no display string', () => {
    const player = makePlayer(2, 2);
    executeMove(player, { x: 3, y: 2 }, level);

    const move = gameLog.getAll().find(e => e.action === 'move');
    expect(move).toMatchObject({ from: { x: 2, y: 2 }, to: { x: 3, y: 2 } });
    expect(move.display).toBeUndefined();
    expect(displays()).toEqual([]); // never surfaces to the player
  });

  it('logs an attack with damage, and a separate death line, with correct pronouns', () => {
    const player = makePlayer(2, 2);
    const goblin = makeGoblin(3, 2, 1); // dies in one hit

    executeAttack(player, { targetEntityId: goblin.id }, level, registry);

    expect(displays()).toEqual([
      'You hit the Goblin for 1 damage.',
      'The Goblin dies.',
    ]);
  });

  it('logs player death in second person when an NPC lands the killing blow', () => {
    const goblin = makeGoblin(3, 2);
    const player = makePlayer(2, 2);
    player.components.get('health') ?? registry.addComponent(player, 'health', components.health(1, 1));

    executeAttack(goblin, { targetEntityId: player.id }, level, registry);

    expect(displays()).toContain('The Goblin hits you for 1 damage.');
    expect(displays()).toContain('You die.');
  });
});
