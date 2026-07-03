import { describe, it, expect, beforeEach } from 'vitest';
import { describeTile } from './describe-tile.js';
import { createLevel } from './level.js';
import { createDoor, createChest, createStairs } from '../entities/furniture.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../entities/components.js';

function makeLevel(w = 7, h = 7) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

function makeViewer(registry, x, y, { visible = [], memory = [] } = {}) {
  const v = registry.createEntity();
  registry.addComponent(v, 'position', components.position(x, y));
  const tp = components.tilePerception();
  for (const k of visible) tp.visible.add(k);
  for (const [k, tileId] of memory) tp.memory.set(k, tileId);
  registry.addComponent(v, 'tilePerception', tp);
  return v;
}

function placeCreature(registry, level, x, y, name) {
  const c = registry.createEntity();
  registry.addComponent(c, 'position', components.position(x, y));
  registry.addComponent(c, 'name', components.name(name));
  registry.addComponent(c, 'creature', components.creature());
  level.placeEntity(c);
  return c;
}

function placeItem(registry, level, x, y, name) {
  const it = registry.createEntity();
  registry.addComponent(it, 'position', components.position(x, y));
  registry.addComponent(it, 'name', components.name(name));
  registry.addComponent(it, 'item', components.item({ type: 'floor' }));
  level.placeEntity(it);
  return it;
}

describe('describeTile', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  describe('currently visible', () => {
    it('lists a creature and an open door, creatures first', () => {
      placeCreature(registry, level, 3, 3, 'Orc');
      const door = createDoor(registry, 3, 3);
      door.components.get('openable').isOpen = true;
      level.placeEntity(door);
      const viewer = makeViewer(registry, 2, 2, { visible: ['3,3'] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe('You see an Orc and an open door.');
    });

    it('names an item, lowercased', () => {
      placeItem(registry, level, 3, 3, 'Dagger');
      const viewer = makeViewer(registry, 2, 2, { visible: ['3,3'] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe('You see a dagger.');
    });

    it('describes a chest', () => {
      level.placeEntity(createChest(registry, 3, 3));
      const viewer = makeViewer(registry, 2, 2, { visible: ['3,3'] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe('You see a chest.');
    });

    it('describes stairs by direction', () => {
      level.placeEntity(createStairs(registry, 3, 3, 'down'));
      const viewer = makeViewer(registry, 2, 2, { visible: ['3,3'] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe('You see stairs leading down.');
    });

    it('falls back to the terrain on an empty floor tile', () => {
      const viewer = makeViewer(registry, 2, 2, { visible: ['4,4'] });
      expect(describeTile(level, viewer, { x: 4, y: 4 })).toBe('You see the floor.');
    });

    it('describes a wall', () => {
      level.tiles[4][4] = 'wall';
      const viewer = makeViewer(registry, 2, 2, { visible: ['4,4'] });
      expect(describeTile(level, viewer, { x: 4, y: 4 })).toBe('You see a wall.');
    });

    it('joins three things with an Oxford comma', () => {
      placeCreature(registry, level, 3, 3, 'Orc');
      placeItem(registry, level, 3, 3, 'Dagger');
      level.placeEntity(createChest(registry, 3, 3));
      const viewer = makeViewer(registry, 2, 2, { visible: ['3,3'] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe(
        'You see an Orc, a dagger, and a chest.',
      );
    });

    it('reports the self tile as standing here when empty', () => {
      const viewer = makeViewer(registry, 2, 2, { visible: ['2,2'] });
      expect(describeTile(level, viewer, { x: 2, y: 2 })).toBe('You are standing here.');
    });
  });

  describe('remembered (in fog)', () => {
    it('names remembered furniture but not creatures or items', () => {
      const door = createDoor(registry, 3, 3); // closed
      level.placeEntity(door);
      placeCreature(registry, level, 3, 3, 'Orc'); // present but not remembered
      const viewer = makeViewer(registry, 2, 2, { memory: [['3,3', 'floor']] });
      expect(describeTile(level, viewer, { x: 3, y: 3 })).toBe('You remember a closed door there.');
    });

    it('falls back to remembered terrain when no furniture', () => {
      const viewer = makeViewer(registry, 2, 2, { memory: [['5,5', 'wall']] });
      expect(describeTile(level, viewer, { x: 5, y: 5 })).toBe('You remember a wall there.');
    });
  });

  it('reports an unseen tile as out of sight', () => {
    const viewer = makeViewer(registry, 2, 2, {});
    expect(describeTile(level, viewer, { x: 6, y: 6 })).toBe("You can't see there.");
  });
});
