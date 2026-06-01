import { describe, it, expect, beforeEach } from 'vitest';
import { createBoulder, createDoor } from './furniture.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';

describe('createBoulder', () => {
  let registry, boulder;

  beforeEach(() => {
    registry = createEntityRegistry();
    boulder = createBoulder(registry, 3, 4);
  });

  it('places the boulder at the given position', () => {
    expect(boulder.components.get('position')).toEqual({ x: 3, y: 4 });
  });

  it('blocks movement', () => {
    expect(boulder.components.has('blocksMovement')).toBe(true);
  });

  it('is opaque', () => {
    expect(boulder.components.has('opaque')).toBe(true);
  });

  it('is renderable', () => {
    expect(boulder.components.has('renderable')).toBe(true);
  });
});

describe('createDoor', () => {
  let registry, door;

  beforeEach(() => {
    registry = createEntityRegistry();
    door = createDoor(registry, 5, 3);
  });

  it('places the door at the given position', () => {
    expect(door.components.get('position')).toEqual({ x: 5, y: 3 });
  });

  it('starts closed (blocksMovement present)', () => {
    expect(door.components.has('blocksMovement')).toBe(true);
  });

  it('starts closed (opaque present)', () => {
    expect(door.components.has('opaque')).toBe(true);
  });

  it('starts closed (isOpen is false)', () => {
    expect(door.components.get('openable').isOpen).toBe(false);
  });

  it('renderable sprite matches closedSprite on the openable component', () => {
    const { closedSprite } = door.components.get('openable');
    expect(door.components.get('renderable').sprite).toEqual(closedSprite);
  });

  it('has distinct closedSprite and openSprite', () => {
    const { closedSprite, openSprite } = door.components.get('openable');
    expect(closedSprite).not.toEqual(openSprite);
  });
});
