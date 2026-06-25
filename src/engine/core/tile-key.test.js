import { describe, it, expect } from 'vitest';
import { tileKey, parseTileKey } from './tile-key.js';

describe('tileKey', () => {
  it('encodes coordinates as an "x,y" string', () => {
    expect(tileKey(3, 7)).toBe('3,7');
  });

  it('handles zero and negative coordinates', () => {
    expect(tileKey(0, 0)).toBe('0,0');
    expect(tileKey(-1, -4)).toBe('-1,-4');
  });
});

describe('parseTileKey', () => {
  it('decodes an "x,y" string back into numbers', () => {
    expect(parseTileKey('3,7')).toEqual({ x: 3, y: 7 });
  });

  it('decodes negative coordinates', () => {
    expect(parseTileKey('-1,-4')).toEqual({ x: -1, y: -4 });
  });
});

describe('round-trip', () => {
  it('parseTileKey inverts tileKey', () => {
    for (const [x, y] of [
      [0, 0],
      [5, 12],
      [-3, 8],
      [99, -7],
    ]) {
      expect(parseTileKey(tileKey(x, y))).toEqual({ x, y });
    }
  });
});
