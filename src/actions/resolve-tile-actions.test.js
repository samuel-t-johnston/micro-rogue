import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTileActions } from './resolve-tile-actions.js';
import { createLevel } from '../world/level.js';
import { createBoulder, createChest, createDoor, createStairs } from '../world/furniture.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from '../world/components.js';

function makeLevel(w = 5, h = 5) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

const PLAYER = { x: 2, y: 2 };
// Every tile carries a trailing free 'look' row; the gameplay assertions below ignore it.
const gameplay = (rows) => rows.filter(r => r.id !== 'look');
const ids = (rows) => gameplay(rows).map(r => r.id);
const resolve = (level, x, y) => resolveTileActions(level, PLAYER, { x, y });

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

  it('opens an adjacent container (a chest)', () => {
    const chest = createChest(registry, 2, 1);
    level.placeEntity(chest);
    const rows = resolve(level, 2, 1);
    expect(ids(rows)).toEqual(['open-container']);
    expect(rows[0].action).toEqual({ type: 'interact', targetEntityId: chest.id });
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
    expect(ids(rows)).toEqual(['self']);
    expect(rows[0].label).toBe('Pick up the Dagger');
    expect(rows[0].action).toEqual({ type: 'selfInteract' });
  });

  it('labels stairs underfoot by direction', () => {
    level.placeEntity(createStairs(registry, 2, 2, 'down'));
    const rows = resolve(level, 2, 2);
    expect(ids(rows)).toEqual(['self']);
    expect(rows[0].label).toBe('Descend');
  });

  it('offers nothing but Look on an empty self tile', () => {
    expect(gameplay(resolve(level, 2, 2))).toEqual([]);
  });

  it('offers Look last on every tile, as a free action', () => {
    level.placeEntity(createDoor(registry, 2, 1)); // a tile with gameplay actions
    for (const [x, y] of [[3, 2], [2, 1], [0, 0], [2, 2]]) { // empty adj, door, distant, self
      const rows = resolve(level, x, y);
      const last = rows[rows.length - 1];
      expect(last).toEqual({ id: 'look', label: 'Look', action: { type: 'lookAt', x, y }, free: true });
    }
  });
});
