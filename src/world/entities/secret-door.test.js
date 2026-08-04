import { describe, it, expect, beforeEach } from 'vitest';
import { createSecretDoor, revealSecret } from './furniture.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';
import { describeTile } from '../map/describe-tile.js';
import { resolveTileActions } from '../../actions/core/resolve-tile-actions.js';
import { getTileType } from '../map/tile-registry.js';

// A one-row level: floor, then a wall at (1,0) hiding a secret door, then floor.
function makeLevel() {
  const level = createLevel();
  level.width = 3;
  level.height = 1;
  level.tiles = [['floor', 'wall', 'floor']];
  return level;
}

describe('secret doors', () => {
  let registry, level, door;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
    door = createSecretDoor(registry, 1, 0, { revealFloor: 'floor' });
    level.placeEntity(door);
  });

  describe('while dormant', () => {
    it("carries the secret marker but none of a door's components", () => {
      expect(door.components.has('secret')).toBe(true);
      expect(door.components.has('position')).toBe(true);
      expect(door.components.get('entityTypeId')).toBe('secretDoor');
      for (const c of ['name', 'renderable', 'openable', 'blocksMovement', 'opaque']) {
        expect(door.components.has(c)).toBe(false);
      }
    });

    it('is impassable, because the wall terrain blocks — not the entity', () => {
      expect(level.isPassable(1, 0)).toBe(false);
      expect(getTileType(level.getTile(1, 0)).opaque).toBe(true);
    });

    it('looks like a wall to the "look" description', () => {
      expect(describeTile(level, null, { x: 1, y: 0 })).toBe('You see a wall.');
    });

    it('offers only "Look" on its tile — no door actions', () => {
      const actions = resolveTileActions(level, { x: 0, y: 0 }, { x: 1, y: 0 });
      expect(actions.map((a) => a.id)).toEqual(['look']);
    });
  });

  describe('reveal', () => {
    it('swaps the wall to floor and reconstitutes a closed door', () => {
      expect(revealSecret(door, level, registry)).toBe(true);

      expect(level.getTile(1, 0)).toBe('floor');
      expect(door.components.has('secret')).toBe(false);
      expect(door.components.get('name')).toBe('Door');
      expect(door.components.has('renderable')).toBe(true);
      expect(door.components.get('openable').isOpen).toBe(false);
      expect(door.components.has('blocksMovement')).toBe(true);
      expect(door.components.has('opaque')).toBe(true);
    });

    it('makes the tile read as a door once revealed', () => {
      revealSecret(door, level, registry);
      expect(describeTile(level, null, { x: 1, y: 0 })).toBe('You see a closed door.');
      const actions = resolveTileActions(level, { x: 0, y: 0 }, { x: 1, y: 0 });
      expect(actions.map((a) => a.id)).toContain('open');
    });

    it('is idempotent — revealing an already-revealed door is a no-op', () => {
      revealSecret(door, level, registry);
      expect(revealSecret(door, level, registry)).toBe(false);
      expect(level.getTile(1, 0)).toBe('floor');
    });
  });
});
