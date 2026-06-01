import { describe, it, expect, beforeEach } from 'vitest';
import { createPotion } from './items.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';

describe('createPotion', () => {
  let registry, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    potion = createPotion(registry, 3, 4);
  });

  it('places the potion at the given position', () => {
    expect(potion.components.get('position')).toEqual({ x: 3, y: 4 });
  });

  it('has the item component with map location', () => {
    expect(potion.components.get('item').location).toEqual({ type: 'map' });
  });

  it('is renderable', () => {
    expect(potion.components.has('renderable')).toBe(true);
  });

  it('does not block movement', () => {
    expect(potion.components.has('blocksMovement')).toBe(false);
  });
});
