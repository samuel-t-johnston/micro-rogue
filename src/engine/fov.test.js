import { describe, it, expect } from 'vitest';
import { computeFov } from './fov.js';

// isOpaque: treats everything outside the w×h bounds as a wall.
function openMap(w, h) {
  return (x, y) => x < 0 || y < 0 || x >= w || y >= h;
}

// isOpaque: explicit wall list plus bounds.
function mapWithWalls(walls, w, h) {
  const wallSet = new Set(walls.map(([x, y]) => `${x},${y}`));
  return (x, y) => x < 0 || y < 0 || x >= w || y >= h || wallSet.has(`${x},${y}`);
}

describe('computeFov', () => {
  it('always includes the origin', () => {
    const visible = computeFov(5, 5, undefined, openMap(10, 10));
    expect(visible.has('5,5')).toBe(true);
  });

  it('sees all tiles in a small open map from the center', () => {
    const visible = computeFov(2, 2, undefined, openMap(5, 5));
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(visible.has(`${x},${y}`), `(${x},${y}) should be visible`).toBe(true);
      }
    }
  });

  it('a wall directly east reveals itself but blocks tiles further east', () => {
    const visible = computeFov(5, 5, undefined, mapWithWalls([[7, 5]], 15, 15));
    expect(visible.has('6,5')).toBe(true);   // floor before wall
    expect(visible.has('7,5')).toBe(true);   // wall face always revealed
    expect(visible.has('8,5')).toBe(false);  // directly behind wall
    expect(visible.has('10,5')).toBe(false); // further behind wall
  });

  it('a wall directly north reveals itself but blocks tiles further north', () => {
    const visible = computeFov(5, 5, undefined, mapWithWalls([[5, 3]], 15, 15));
    expect(visible.has('5,4')).toBe(true);   // floor before wall
    expect(visible.has('5,3')).toBe(true);   // wall face visible
    expect(visible.has('5,2')).toBe(false);  // blocked
  });

  it('clips tiles beyond the range parameter using circular distance', () => {
    const visible = computeFov(9, 9, 3, openMap(20, 20));
    expect(visible.has('12,9')).toBe(true);   // exactly 3 east
    expect(visible.has('9,12')).toBe(true);   // exactly 3 south
    expect(visible.has('11,11')).toBe(true);  // sqrt(8) ≈ 2.83 — within range
    expect(visible.has('13,9')).toBe(false);  // 4 east — beyond range
    expect(visible.has('12,12')).toBe(false); // sqrt(18) ≈ 4.24 — beyond range
  });

  it('is symmetric: if origin sees tile T, then T sees origin', () => {
    // Room with a 2×2 pillar — exercises shadow edges on all sides.
    // Symmetry only applies to in-bounds tiles; boundary "wall reveals" are excluded.
    const w = 20, h = 20;
    const isOpaque = mapWithWalls([[8, 8], [8, 9], [9, 8], [9, 9]], w, h);
    const fromOrigin = computeFov(5, 5, undefined, isOpaque);
    for (const key of fromOrigin) {
      const [bx, by] = key.split(',').map(Number);
      if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
      const fromB = computeFov(bx, by, undefined, isOpaque);
      expect(
        fromB.has('5,5'),
        `(${bx},${by}) should see (5,5) since (5,5) sees (${bx},${by})`,
      ).toBe(true);
    }
  });
});
