import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTileActions } from './resolve-tile-actions.js';
import { createLevel } from '../../world/map/level.js';
import {
  createBoulder,
  createChest,
  createDoor,
  createStairs,
} from '../../world/entities/furniture.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';

function makeLevel(w = 5, h = 5) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

const PLAYER = { x: 2, y: 2 };
// Every tile carries a trailing free 'look' row; the gameplay assertions below ignore it.
const gameplay = (rows) => rows.filter((r) => r.id !== 'look');
const ids = (rows) => gameplay(rows).map((r) => r.id);
const resolve = (level, x, y) => resolveTileActions(level, PLAYER, { x, y });
const resolveWith = (level, x, y, capability) =>
  resolveTileActions(level, PLAYER, { x, y }, capability);

describe('resolveTileActions', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  it('offers a move into an empty, passable adjacent tile', () => {
    const rows = resolve(level, 3, 2);
    expect(ids(rows)).toEqual(['move']);
    expect(rows[0].action).toEqual({ type: 'move', x: 3, y: 2 });
  });

  it('offers nothing for an adjacent wall with nothing on it', () => {
    level.tiles[1][2] = 'wall';
    expect(gameplay(resolve(level, 2, 1))).toEqual([]);
  });

  it('offers nothing for an adjacent blocking, non-interactable entity', () => {
    level.placeEntity(createBoulder(registry, 2, 1));
    expect(gameplay(resolve(level, 2, 1))).toEqual([]);
  });

  it('attacks an adjacent creature (entity with health) as the primary action', () => {
    const creature = registry.createEntity();
    registry.addComponent(creature, 'position', components.position(2, 1));
    registry.addComponent(creature, 'health', components.health(5, 5));
    registry.addComponent(creature, 'blocksMovement', components.blocksMovement());
    level.placeEntity(creature);

    const rows = resolve(level, 2, 1);
    expect(ids(rows)).toEqual(['attack']);
    expect(rows[0].action).toEqual({ type: 'attack', targetEntityId: creature.id });
  });

  function makeCreature(x, y) {
    const c = registry.createEntity();
    registry.addComponent(c, 'position', components.position(x, y));
    registry.addComponent(c, 'health', components.health(5, 5));
    registry.addComponent(c, 'blocksMovement', components.blocksMovement());
    level.placeEntity(c);
    return c;
  }

  it('offers a ranged attack on a distant creature within range and line of sight', () => {
    const creature = makeCreature(4, 2); // two tiles east, clear floor between
    const rows = resolveWith(level, 4, 2, { range: 15, meleeRange: 1 });
    expect(ids(rows)).toEqual(['attack']);
    expect(rows[0].action).toEqual({ type: 'attack', targetEntityId: creature.id });
  });

  it('does not offer an attack on a creature beyond weapon range', () => {
    makeCreature(4, 2); // distance 2
    expect(gameplay(resolveWith(level, 4, 2, { range: 1, meleeRange: 1 }))).toEqual([]);
  });

  it('does not offer a ranged attack when a wall blocks the line of sight', () => {
    makeCreature(4, 2);
    level.tiles[2][3] = 'wall'; // between the player (2,2) and the creature (4,2)
    expect(gameplay(resolveWith(level, 4, 2, { range: 15, meleeRange: 1 }))).toEqual([]);
  });

  it('fires point-blank when meleeRange is 0 (a bow has no free melee)', () => {
    const creature = makeCreature(2, 1); // adjacent
    const rows = resolveWith(level, 2, 1, { range: 15, meleeRange: 0 });
    expect(ids(rows)).toEqual(['attack']);
    expect(rows[0].action).toEqual({ type: 'attack', targetEntityId: creature.id });
  });

  it('defaults a closed adjacent door to opening it, with no move offered (it blocks)', () => {
    level.placeEntity(createDoor(registry, 2, 1));
    const rows = resolve(level, 2, 1);
    expect(ids(rows)).toEqual(['open']);
    expect(rows[0].action.type).toBe('interact');
  });

  it('defaults an open adjacent door to moving through it, with Close offered second', () => {
    const door = createDoor(registry, 2, 1);
    door.components.get('openable').isOpen = true;
    registry.removeComponent(door, 'blocksMovement'); // open doors are passable
    level.placeEntity(door);

    const rows = resolve(level, 2, 1);
    expect(ids(rows)).toEqual(['move', 'close']);
    expect(rows[0].action).toEqual({ type: 'move', x: 2, y: 1 });
    expect(rows[1].action).toEqual({ type: 'interact', targetEntityId: door.id });
  });

  it('opens an adjacent container (a chest), with Place items offered second', () => {
    const chest = createChest(registry, 2, 1);
    level.placeEntity(chest);
    const rows = resolve(level, 2, 1);
    expect(ids(rows)).toEqual(['open-container', 'store']);
    expect(rows[0].action).toEqual({ type: 'interact', targetEntityId: chest.id });
    expect(rows[1].action).toEqual({ type: 'interact', targetEntityId: chest.id, mode: 'store' });
  });

  it('offers a move to a distant passable tile (the goal handles pathing)', () => {
    const rows = resolve(level, 0, 0);
    expect(ids(rows)).toEqual(['move']);
    expect(rows[0].action).toEqual({ type: 'move', x: 0, y: 0 });
  });

  it('offers nothing for a distant wall', () => {
    level.tiles[0][0] = 'wall';
    expect(gameplay(resolve(level, 0, 0))).toEqual([]);
  });

  it('picks up a single item on the self tile, named', () => {
    const item = registry.createEntity();
    registry.addComponent(item, 'position', components.position(2, 2));
    registry.addComponent(item, 'name', components.name('Dagger'));
    registry.addComponent(item, 'item', components.item({ type: 'floor' }));
    level.placeEntity(item);

    const rows = resolve(level, 2, 2);
    expect(ids(rows)).toEqual(['self', 'wait']);
    expect(rows[0].label).toBe('Pick up the Dagger');
    expect(rows[0].action).toEqual({ type: 'selfInteract' });
  });

  it('labels stairs underfoot by direction, with Wait offered second', () => {
    level.placeEntity(createStairs(registry, 2, 2, 'down'));
    const rows = resolve(level, 2, 2);
    expect(ids(rows)).toEqual(['self', 'wait']);
    expect(rows[0].label).toBe('Descend');
  });

  it('offers Wait as the only gameplay action on an empty self tile', () => {
    const rows = resolve(level, 2, 2);
    expect(ids(rows)).toEqual(['wait']);
    expect(rows[0].action).toEqual({ type: 'wait' });
  });

  it('offers Look last on every tile, as a free action', () => {
    level.placeEntity(createDoor(registry, 2, 1)); // a tile with gameplay actions
    for (const [x, y] of [
      [3, 2],
      [2, 1],
      [0, 0],
      [2, 2],
    ]) {
      // empty adj, door, distant, self
      const rows = resolve(level, x, y);
      const last = rows[rows.length - 1];
      expect(last).toEqual({
        id: 'look',
        label: 'Look',
        action: { type: 'lookAt', x, y },
        free: true,
      });
    }
  });
});
