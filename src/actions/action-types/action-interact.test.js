import { describe, it, expect, beforeEach } from 'vitest';
import { executeInteract } from './action-interact.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../../world/level.js';
import { createDoor } from '../../world/furniture.js';

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

  it('returns false (consumes a turn)', () => {
    expect(executeInteract(actor, { targetEntityId: door.id }, level, registry)).toBe(false);
  });

  it('returns false and does nothing when target not found', () => {
    const result = executeInteract(actor, { targetEntityId: 9999 }, level, registry);
    expect(result).toBe(false);
    expect(door.components.get('openable').isOpen).toBe(false);
  });
});
