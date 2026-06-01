import { describe, it, expect, beforeEach } from 'vitest';
import { createLevel } from './level.js';

describe('createLevel', () => {
  it('initializes with zeroed dimensions and empty collections', () => {
    const level = createLevel();
    expect(level.width).toBe(0);
    expect(level.height).toBe(0);
    expect(level.tiles).toEqual([]);
    expect(level.overrides.size).toBe(0);
    expect(level.entities).toEqual([]);
    expect(level.blackboard).toEqual({});
  });
});

describe('getTile', () => {
  let level;

  beforeEach(() => {
    level = createLevel();
    level.width = 3;
    level.height = 2;
    level.tiles = [
      ['wall',  'floor', 'wall'],
      ['floor', 'floor', 'floor'],
    ];
  });

  it('returns the tile id at the given coordinates', () => {
    expect(level.getTile(0, 0)).toBe('wall');
    expect(level.getTile(1, 0)).toBe('floor');
    expect(level.getTile(2, 1)).toBe('floor');
  });

  it('returns an override when one is set', () => {
    level.overrides.set('1,0', 'wall');
    expect(level.getTile(1, 0)).toBe('wall');
  });

  it('override does not affect other tiles', () => {
    level.overrides.set('1,0', 'wall');
    expect(level.getTile(0, 0)).toBe('wall');
    expect(level.getTile(1, 1)).toBe('floor');
  });

  it('returns null for out-of-bounds x', () => {
    expect(level.getTile(-1, 0)).toBeNull();
    expect(level.getTile(3, 0)).toBeNull();
  });

  it('returns null for out-of-bounds y', () => {
    expect(level.getTile(0, -1)).toBeNull();
    expect(level.getTile(0, 2)).toBeNull();
  });
});

describe('spatial index', () => {
  let level;

  function makeEntity(x, y, extraComponents = []) {
    const components = new Map([['position', { x, y }], ...extraComponents]);
    return { id: Math.random(), components };
  }

  beforeEach(() => {
    level = createLevel();
    level.width = 5;
    level.height = 5;
    level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  });

  describe('placeEntity', () => {
    it('adds the entity to getEntitiesAt its position', () => {
      const entity = makeEntity(2, 3);
      level.placeEntity(entity);
      expect(level.getEntitiesAt(2, 3).has(entity)).toBe(true);
    });

    it('adds the entity to the entities list', () => {
      const entity = makeEntity(1, 1);
      level.placeEntity(entity);
      expect(level.entities).toContain(entity);
    });

    it('throws if the entity has no position component', () => {
      const entity = { id: 99, components: new Map() };
      expect(() => level.placeEntity(entity)).toThrow();
    });
  });

  describe('getEntitiesAt', () => {
    it('returns an empty Set for a tile with no entities', () => {
      expect(level.getEntitiesAt(0, 0).size).toBe(0);
    });

    it('returns multiple entities at the same tile', () => {
      const a = makeEntity(1, 1);
      const b = makeEntity(1, 1);
      level.placeEntity(a);
      level.placeEntity(b);
      const result = level.getEntitiesAt(1, 1);
      expect(result.has(a)).toBe(true);
      expect(result.has(b)).toBe(true);
    });
  });

  describe('moveEntity', () => {
    it('updates the entity position component', () => {
      const entity = makeEntity(1, 1);
      level.placeEntity(entity);
      level.moveEntity(entity, 2, 3);
      expect(entity.components.get('position')).toEqual({ x: 2, y: 3 });
    });

    it('removes the entity from its old tile in the index', () => {
      const entity = makeEntity(1, 1);
      level.placeEntity(entity);
      level.moveEntity(entity, 2, 3);
      expect(level.getEntitiesAt(1, 1).has(entity)).toBe(false);
    });

    it('adds the entity to its new tile in the index', () => {
      const entity = makeEntity(1, 1);
      level.placeEntity(entity);
      level.moveEntity(entity, 2, 3);
      expect(level.getEntitiesAt(2, 3).has(entity)).toBe(true);
    });
  });

  describe('removeEntity', () => {
    it('removes the entity from the spatial index', () => {
      const entity = makeEntity(2, 2);
      level.placeEntity(entity);
      level.removeEntity(entity);
      expect(level.getEntitiesAt(2, 2).has(entity)).toBe(false);
    });

    it('removes the entity from the entities list', () => {
      const entity = makeEntity(2, 2);
      level.placeEntity(entity);
      level.removeEntity(entity);
      expect(level.entities).not.toContain(entity);
    });
  });
});

describe('isPassable', () => {
  let level;

  function makeEntity(x, y, extraComponents = []) {
    const components = new Map([['position', { x, y }], ...extraComponents]);
    return { id: Math.random(), components };
  }

  beforeEach(() => {
    level = createLevel();
    level.width = 3;
    level.height = 3;
    level.tiles = [
      ['wall',  'floor', 'wall'],
      ['floor', 'floor', 'floor'],
      ['wall',  'floor', 'wall'],
    ];
  });

  it('returns false for an impassable tile', () => {
    expect(level.isPassable(0, 0)).toBe(false);
  });

  it('returns true for a passable tile with no blocking entities', () => {
    expect(level.isPassable(1, 0)).toBe(true);
  });

  it('returns false for out-of-bounds coordinates', () => {
    expect(level.isPassable(-1, 0)).toBe(false);
    expect(level.isPassable(0, 5)).toBe(false);
  });

  it('returns false when a blocksMovement entity is on a passable tile', () => {
    const boulder = makeEntity(1, 1, [['blocksMovement', {}]]);
    level.placeEntity(boulder);
    expect(level.isPassable(1, 1)).toBe(false);
  });

  it('returns true when a non-blocking entity is on a passable tile', () => {
    const entity = makeEntity(1, 1); // no blocksMovement
    level.placeEntity(entity);
    expect(level.isPassable(1, 1)).toBe(true);
  });
});
