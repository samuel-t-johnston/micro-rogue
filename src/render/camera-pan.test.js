import { describe, it, expect } from 'vitest';
import { clampCamera, panCamera } from './camera-pan.js';

const bounds = { width: 40, height: 30 };

describe('clampCamera', () => {
  it('leaves an in-bounds centre untouched', () => {
    expect(clampCamera({ x: 10, y: 12 }, bounds)).toEqual({ x: 10, y: 12 });
  });

  it('clamps past the left and top edges to zero', () => {
    expect(clampCamera({ x: -5, y: -1 }, bounds)).toEqual({ x: 0, y: 0 });
  });

  it('clamps past the right and bottom edges to the last tile', () => {
    expect(clampCamera({ x: 100, y: 100 }, bounds)).toEqual({ x: 39, y: 29 });
  });
});

describe('panCamera', () => {
  it('converts a screen drag to a tile shift in the opposite direction', () => {
    // Drag 64px right and 32px down at a 32px tile size → camera moves 2 tiles left, 1 tile up.
    expect(panCamera({ x: 10, y: 10 }, 64, 32, 32, bounds)).toEqual({ x: 8, y: 9 });
  });

  it('scales the shift by the tile size', () => {
    // The same 64px drag at a 16px tile size moves twice as far (4 tiles).
    expect(panCamera({ x: 10, y: 10 }, 64, 0, 16, bounds)).toEqual({ x: 6, y: 10 });
  });

  it('clamps the panned result to the level bounds', () => {
    expect(panCamera({ x: 1, y: 1 }, 320, 320, 32, bounds)).toEqual({ x: 0, y: 0 });
  });
});
