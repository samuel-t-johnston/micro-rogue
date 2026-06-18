import { describe, it, expect } from 'vitest';
import { cardinalDirection } from './geometry.js';

const origin = { x: 5, y: 5 };

describe('cardinalDirection', () => {
  it('returns null when the points coincide', () => {
    expect(cardinalDirection(origin, { x: 5, y: 5 })).toBeNull();
  });

  it('maps the four cardinal axes (y-down grid: smaller y is north)', () => {
    expect(cardinalDirection(origin, { x: 5, y: 1 })).toBe('N');
    expect(cardinalDirection(origin, { x: 5, y: 9 })).toBe('S');
    expect(cardinalDirection(origin, { x: 9, y: 5 })).toBe('E');
    expect(cardinalDirection(origin, { x: 1, y: 5 })).toBe('W');
  });

  it('maps the four diagonals', () => {
    expect(cardinalDirection(origin, { x: 9, y: 1 })).toBe('NE');
    expect(cardinalDirection(origin, { x: 9, y: 9 })).toBe('SE');
    expect(cardinalDirection(origin, { x: 1, y: 9 })).toBe('SW');
    expect(cardinalDirection(origin, { x: 1, y: 1 })).toBe('NW');
  });

  it('rounds a shallow off-axis bearing to the nearer cardinal', () => {
    // Far east, slightly north — well within the E sector (< 22.5° off axis).
    expect(cardinalDirection(origin, { x: 15, y: 4 })).toBe('E');
  });
});
