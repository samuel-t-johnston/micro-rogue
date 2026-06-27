import { describe, it, expect, beforeEach } from 'vitest';
import { executeInteract } from './action-interact.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createDoor, createChest } from '../../world/entities/furniture.js';
import { components } from '../../world/entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';

// A minimal inventory/container item: a name and an `item` component carrying its location.
function makeItem(registry, name, location = { type: 'inventory' }) {
  const item = registry.createEntity();
  registry.addComponent(item, 'name', components.name(name));
  registry.addComponent(item, 'item', components.item(location));
  return item;
}

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('executeInteract — door', () => {
  let registry, level, door, actor;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    door = createDoor(registry, 2, 2);
    level.placeEntity(door);
    actor = registry.createEntity();
    registry.addComponent(actor, 'position', { x: 2, y: 1 });
  });

  describe('opening a closed door', () => {
    it('sets isOpen to true', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.get('openable').isOpen).toBe(true);
    });

    it('removes blocksMovement', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.has('blocksMovement')).toBe(false);
    });

    it('removes opaque', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.has('opaque')).toBe(false);
    });

    it('swaps renderable sprite to openSprite', () => {
      const { openSprite } = door.components.get('openable');
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.get('renderable').sprite).toEqual(openSprite);
    });
  });

  describe('closing an open door', () => {
    beforeEach(() => {
      // Open it first
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
    });

    it('sets isOpen to false', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.get('openable').isOpen).toBe(false);
    });

    it('restores blocksMovement', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.has('blocksMovement')).toBe(true);
    });

    it('restores opaque', () => {
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.has('opaque')).toBe(true);
    });

    it('swaps renderable sprite back to closedSprite', () => {
      const { closedSprite } = door.components.get('openable');
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.get('renderable').sprite).toEqual(closedSprite);
    });
  });

  describe('closing a door blocked by an occupant', () => {
    let occupant;

    beforeEach(() => {
      // Open the door, then put another entity on its tile.
      executeInteract(actor, { targetEntityId: door.id }, level, registry);
      occupant = registry.createEntity();
      registry.addComponent(occupant, 'position', { x: 2, y: 2 });
      registry.addComponent(occupant, 'name', 'Orc');
      level.placeEntity(occupant);
    });

    it('leaves the door open', async () => {
      await executeInteract(actor, { targetEntityId: door.id }, level, registry);
      expect(door.components.get('openable').isOpen).toBe(true);
      expect(door.components.has('blocksMovement')).toBe(false);
    });

    it('is a free action (does not consume the turn)', async () => {
      expect(await executeInteract(actor, { targetEntityId: door.id }, level, registry)).toBe(true);
    });

    it('logs that the occupant blocks the door, named with "the"', async () => {
      await executeInteract(actor, { targetEntityId: door.id }, level, registry);
      const [entry] = gameLog.getDisplayEntries(1);
      expect(entry.display).toBe('The orc blocks the door from closing.');
    });
  });

  it('returns false (consumes a turn)', async () => {
    expect(await executeInteract(actor, { targetEntityId: door.id }, level, registry)).toBe(false);
  });

  it('returns false and does nothing when target not found', async () => {
    const result = await executeInteract(actor, { targetEntityId: 9999 }, level, registry);
    expect(result).toBe(false);
    expect(door.components.get('openable').isOpen).toBe(false);
  });
});

describe('executeInteract — container (placing items via mode: store)', () => {
  let registry, level, chest, actor, inventory, dialogController, dialogArgs;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    chest = createChest(registry, 2, 2);
    level.placeEntity(chest);
    actor = registry.createEntity();
    registry.addComponent(actor, 'name', components.name('Player'));
    registry.addComponent(actor, 'playerControlled', {});
    registry.addComponent(actor, 'position', { x: 2, y: 1 });
    inventory = { items: [] };
    registry.addComponent(actor, 'inventory', inventory);
    // Records what the dialog was asked to show, and confirms with whichever items the test queues.
    dialogArgs = null;
    dialogController = {
      confirmWith: [],
      confirmed: true,
      showItemList: async (args) => {
        dialogArgs = args;
        return { confirmed: dialogController.confirmed, taken: dialogController.confirmWith };
      },
    };
  });

  const store = () =>
    executeInteract(
      actor,
      { targetEntityId: chest.id, mode: 'store' },
      level,
      registry,
      dialogController,
    );

  it('lists the actor inventory with a Place confirm label', async () => {
    const dagger = makeItem(registry, 'Dagger');
    inventory.items.push(dagger);
    dialogController.confirmWith = [];
    dialogController.confirmed = false;

    await store();

    expect(dialogArgs.items).toBe(inventory.items);
    expect(dialogArgs.confirmLabel).toBe('Place');
  });

  it('moves selected items into the container and rewrites their location', async () => {
    const dagger = makeItem(registry, 'Dagger');
    inventory.items.push(dagger);
    dialogController.confirmWith = [dagger];

    const result = await store();

    expect(result).toBe(false); // turn consumed
    expect(inventory.items).not.toContain(dagger);
    expect(chest.components.get('inventory').items).toContain(dagger);
    expect(dagger.components.get('item').location).toEqual({
      type: 'container',
      containerId: chest.id,
    });
  });

  it('logs each placed item, named, into the lowercased container', async () => {
    const dagger = makeItem(registry, 'Dagger');
    inventory.items.push(dagger);
    dialogController.confirmWith = [dagger];

    await store();

    const [entry] = gameLog.getDisplayEntries(1);
    expect(entry.display).toBe('You put the dagger into the chest.');
  });

  it('is a free action (turn not consumed) when the dialog is cancelled', async () => {
    inventory.items.push(makeItem(registry, 'Dagger'));
    dialogController.confirmed = false;
    dialogController.confirmWith = [];

    expect(await store()).toBe(true);
  });

  it('is a free action and shows no dialog when the actor carries nothing', async () => {
    expect(await store()).toBe(true);
    expect(dialogArgs).toBe(null);
  });

  it('logs feedback when the actor carries nothing to put in', async () => {
    await store();
    const [entry] = gameLog.getDisplayEntries(1);
    expect(entry.display).toBe('You have nothing to put in.');
  });
});

describe('executeInteract — container (taking from an empty container)', () => {
  let registry, level, chest, actor, dialogController, dialogShown;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    chest = createChest(registry, 2, 2);
    level.placeEntity(chest);
    actor = registry.createEntity();
    registry.addComponent(actor, 'name', components.name('Player'));
    registry.addComponent(actor, 'playerControlled', {});
    registry.addComponent(actor, 'position', { x: 2, y: 1 });
    registry.addComponent(actor, 'inventory', { items: [] });
    dialogShown = false;
    dialogController = {
      showItemList: async () => {
        dialogShown = true;
        return { confirmed: false, taken: [] };
      },
    };
  });

  // Tap and menu both arrive here (no mode), so the feedback covers either path.
  const take = () =>
    executeInteract(actor, { targetEntityId: chest.id }, level, registry, dialogController);

  it('is a free action and shows no dialog', async () => {
    expect(await take()).toBe(true);
    expect(dialogShown).toBe(false);
  });

  it('logs that the container is empty, named and lowercased', async () => {
    await take();
    const [entry] = gameLog.getDisplayEntries(1);
    expect(entry.display).toBe('The chest is empty.');
  });
});
