import { describe, it, expect, beforeEach } from 'vitest';
import { executeThrow } from './action-throw.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { gameLog } from '../../engine/log/game-log.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

// An inventory item; `throwable` is the arg tuple [effectType, params, breakChance] when present.
function makeItem(registry, name, { throwable } = {}) {
  const item = registry.createEntity();
  registry.addComponent(item, 'name', components.name(name));
  registry.addComponent(item, 'item', components.item({ type: 'inventory' }));
  if (throwable) registry.addComponent(item, 'throwable', components.throwable(...throwable));
  return item;
}

function makeCreature(registry, level, x, y, { name = 'orc', hp = 10 } = {}) {
  const e = registry.createEntity();
  registry.addComponent(e, 'name', components.name(name));
  registry.addComponent(e, 'attributes', components.attributes({ hp, con: hp })); // maxHP = con
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'creature', components.creature());
  registry.addComponent(e, 'blocksMovement', components.blocksMovement());
  level.placeEntity(e);
  return e;
}

// A named tile occupant with no health — something a throw can hit but not affect (a door, a chest).
function makeInert(registry, level, x, y, name) {
  const e = registry.createEntity();
  registry.addComponent(e, 'name', components.name(name));
  registry.addComponent(e, 'position', components.position(x, y));
  level.placeEntity(e);
  return e;
}

// A solid fixture: blocks both movement and item-drop (a boulder, a chest, a closed door). Unlike a
// creature it has no `creature` marker, so a thrown item can't come to rest on its tile.
function makeBlocker(registry, level, x, y, name = 'boulder') {
  const e = registry.createEntity();
  registry.addComponent(e, 'name', components.name(name));
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'blocksMovement', components.blocksMovement());
  level.placeEntity(e);
  return e;
}

describe('executeThrow', () => {
  let registry, level, actor, inventory;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    actor = registry.createEntity();
    registry.addComponent(actor, 'name', components.name('Player'));
    registry.addComponent(actor, 'playerControlled', {});
    registry.addComponent(actor, 'position', components.position(2, 2));
    inventory = { items: [] };
    registry.addComponent(actor, 'inventory', inventory);
  });

  const throwAt = (item, x, y) =>
    executeThrow(actor, { itemEntityId: item.id, x, y }, level, registry);

  it('applies a throwable effect to a creature on the target tile and consumes the turn', () => {
    const orc = makeCreature(registry, level, 3, 2);
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    const result = throwAt(potion, 3, 2);

    expect(result).toBe(false);
    expect(orc.components.get('attributes').hp).toBe(5);
    expect(inventory.items).toHaveLength(0);
  });

  it('heals a creature when thrown with a heal effect', () => {
    const ally = makeCreature(registry, level, 3, 2, { hp: 10 });
    ally.components.get('attributes').hp = 4;
    const potion = makeItem(registry, 'Healing Potion', { throwable: ['heal', { amount: 5 }, 1] });
    inventory.items.push(potion);

    throwAt(potion, 3, 2);

    expect(ally.components.get('attributes').hp).toBe(9);
  });

  it('shatters (and destroys the item) when breakChance is 1', () => {
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 4, 4); // empty tile

    expect(registry.getEntity(potion.id)).toBeNull();
  });

  it('lands on the target tile (retrievable) when it does not break', () => {
    const knife = makeItem(registry, 'Knife', { throwable: ['damage', { amount: 3 }, 0] });
    inventory.items.push(knife);

    throwAt(knife, 4, 4);

    expect(knife.components.get('item').location).toEqual({ type: 'map' });
    expect(knife.components.get('position')).toEqual({ x: 4, y: 4 });
    expect([...level.getEntitiesAt(4, 4)]).toContain(knife);
  });

  it('an item with no throwable component has no effect and never breaks', () => {
    const orc = makeCreature(registry, level, 3, 2);
    const dagger = makeItem(registry, 'Dagger'); // no throwable
    inventory.items.push(dagger);

    throwAt(dagger, 3, 2);

    expect(orc.components.get('attributes').hp).toBe(10); // unharmed
    expect([...level.getEntitiesAt(3, 2)]).toContain(dagger); // landed, not destroyed
  });

  it('logs an item-subject hit line and an effect-specific reaction line', () => {
    makeCreature(registry, level, 3, 2);
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 3, 2);

    const [hit, reaction] = gameLog.getDisplayEntries(2);
    expect(hit.display).toBe('The potion of pain hits the orc and breaks.');
    expect(reaction.display).toBe('The orc looks hurt.');
  });

  it('names an unaffected target only when nothing was affected', () => {
    makeInert(registry, level, 3, 2, 'door');
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 3, 2);

    const entries = gameLog.getDisplayEntries(5);
    expect(entries).toHaveLength(1); // no reaction line for an unaffected hit
    expect(entries[0].display).toBe('The potion of pain hits the door and breaks.');
  });

  it('omits unaffected occupants from the hit line when something was affected', () => {
    makeCreature(registry, level, 3, 2);
    makeInert(registry, level, 3, 2, 'door');
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 3, 2);

    const [hit] = gameLog.getDisplayEntries(2);
    expect(hit.display).toBe('The potion of pain hits the orc and breaks.');
  });

  it('narrates a shatter on an empty tile with no entities', () => {
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 4, 4);

    const [entry] = gameLog.getDisplayEntries(1);
    expect(entry.display).toBe('The potion of pain shatters on the floor.');
  });

  it("rests at a creature's feet when a non-breaking item lands on its tile", () => {
    makeCreature(registry, level, 3, 2);
    const knife = makeItem(registry, 'Knife', { throwable: ['damage', { amount: 3 }, 0] });
    inventory.items.push(knife);

    throwAt(knife, 3, 2);

    expect(knife.components.get('position')).toEqual({ x: 3, y: 2 });
    expect([...level.getEntitiesAt(3, 2)]).toContain(knife);
  });

  it('stops at a solid fixture and rests on the last clear tile before it', () => {
    makeBlocker(registry, level, 3, 2); // boulder between the actor (2,2) and the aimed tile (4,2)
    const knife = makeItem(registry, 'Knife', { throwable: ['damage', { amount: 3 }, 0] });
    inventory.items.push(knife);

    throwAt(knife, 4, 2);

    expect(knife.components.get('position')).toEqual({ x: 2, y: 2 }); // bounced back, not stranded
    expect([...level.getEntitiesAt(4, 2)]).not.toContain(knife);
  });

  it('drops at the thrower’s feet when an adjacent tile is blocked', () => {
    makeBlocker(registry, level, 3, 2);
    const knife = makeItem(registry, 'Knife', { throwable: ['damage', { amount: 3 }, 0] });
    inventory.items.push(knife);

    throwAt(knife, 3, 2);

    expect(knife.components.get('position')).toEqual({ x: 2, y: 2 });
  });

  it('intercepts the first creature in the flight path, short of the aimed tile', () => {
    const near = makeCreature(registry, level, 3, 2);
    const far = makeCreature(registry, level, 4, 2);
    const potion = makeItem(registry, 'Potion of Pain', {
      throwable: ['damage', { amount: 5 }, 1],
    });
    inventory.items.push(potion);

    throwAt(potion, 4, 2); // aimed past the near creature

    expect(near.components.get('attributes').hp).toBe(5); // hit
    expect(far.components.get('attributes').hp).toBe(10); // untouched
  });

  it('stops at a wall and bounces back rather than resting on it', () => {
    level.tiles[2][3] = 'wall';
    const knife = makeItem(registry, 'Knife', { throwable: ['damage', { amount: 3 }, 0] });
    inventory.items.push(knife);

    throwAt(knife, 4, 2);

    expect(knife.components.get('position')).toEqual({ x: 2, y: 2 });
  });
});
