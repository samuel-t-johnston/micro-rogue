import { describe, it, expect } from 'vitest';
import { run as runCaSeed } from './stage-ca-seed.js';
import { run as runCaSmooth } from './stage-ca-smooth.js';
import { run as runCaBridge } from './stage-ca-bridge.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

// A level with hand-placed floor rectangles on a walled field; bounds cover the whole grid.
function field(w, h, blobs) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  for (const [x0, y0, x1, y1] of blobs)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
  level.blackboard['level:bounds'] = { x: 0, y: 0, w, h };
  return level;
}

function componentCount(level) {
  const floor = (x, y) => level.getTile(x, y) === 'floor';
  const seen = new Set();
  let n = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const k = `${x},${y}`;
      if (!floor(x, y) || seen.has(k)) continue;
      n++;
      const stack = [[x, y]];
      seen.add(k);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nk = `${cx + dx},${cy + dy}`;
          if (floor(cx + dx, cy + dy) && !seen.has(nk)) {
            seen.add(nk);
            stack.push([cx + dx, cy + dy]);
          }
        }
      }
    }
  return n;
}

const floorCount = (level) => {
  let n = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) if (level.getTile(x, y) === 'floor') n++;
  return n;
};

describe('caBridge stage', () => {
  it('bridges separate components into one connected region', () => {
    // Two 4×5 blobs (20 tiles each) with a wall gutter between them.
    const level = field(16, 9, [
      [2, 2, 5, 6],
      [10, 2, 13, 6],
    ]);
    expect(componentCount(level)).toBe(2);
    runCaBridge(level, { minComponentSize: 5 }, level.blackboard, createRng(1));
    expect(componentCount(level)).toBe(1);
  });

  it('prunes components below minComponentSize to wall', () => {
    // One big blob and a single stray floor tile.
    const level = field(16, 9, [
      [2, 2, 5, 6],
      [12, 4, 12, 4],
    ]);
    runCaBridge(level, { minComponentSize: 5 }, level.blackboard, createRng(1));
    expect(level.getTile(12, 4)).toBe('wall'); // the speck is gone
    expect(componentCount(level)).toBe(1);
  });

  it('keeps the single largest component even when all are below the floor', () => {
    // Two tiny blobs, both under minComponentSize — one must survive so the level isn't wiped.
    const level = field(16, 9, [
      [2, 2, 3, 3],
      [11, 5, 12, 6],
    ]);
    runCaBridge(level, { minComponentSize: 50 }, level.blackboard, createRng(1));
    expect(floorCount(level)).toBeGreaterThan(0);
    expect(componentCount(level)).toBe(1);
  });

  it('records the tiles it dug (not passed through) as passage tiles', () => {
    const level = field(16, 9, [
      [2, 2, 5, 6],
      [10, 2, 13, 6],
    ]);
    runCaBridge(level, { minComponentSize: 5 }, level.blackboard, createRng(1));
    const passage = level.blackboard['level:passageTiles'];
    expect(passage.length).toBeGreaterThan(0);
    for (const [x, y] of passage) {
      expect(level.getTile(x, y)).toBe('floor'); // dug to floor
      expect(x).toBeGreaterThan(5); // in the wall gap between the blobs, not inside a blob
      expect(x).toBeLessThan(10);
    }
  });

  it('is deterministic for a given seed', () => {
    const build = () => {
      const level = field(16, 9, [
        [2, 2, 5, 6],
        [10, 2, 13, 6],
      ]);
      runCaBridge(level, { minComponentSize: 5 }, level.blackboard, createRng(7));
      return level.tiles;
    };
    expect(build()).toEqual(build());
  });

  // Deterministic complexity guard (ADR-028): no wall clock. Count tile reads at 1× and 16× tile
  // scale; O(tiles) work grows ~16×, an accidental O(tiles²) would be ~256×. Assert well under that.
  it('does tile work linear in tile count, not quadratic', () => {
    const measure = (scale) => {
      const level = createLevel();
      const bb = level.blackboard;
      runCaSeed(level, { width: 40 * scale, height: 30 * scale }, bb, createRng(1));
      runCaSmooth(level, {}, bb);
      // Count numeric-index reads of the tile grid during caBridge only.
      let reads = 0;
      const rows = level.tiles.map(
        (row) =>
          new Proxy(row, {
            get(t, p) {
              if (typeof p === 'string' && /^\d+$/.test(p)) reads++;
              return t[p];
            },
          }),
      );
      level.tiles = new Proxy(rows, { get: (t, p) => t[p] });
      runCaBridge(level, {}, bb, createRng(1));
      return reads;
    };
    const small = measure(1); // 1200 tiles
    const big = measure(4); // 19200 tiles = 16×
    expect(big / small).toBeLessThan(40); // linear ≈16×; quadratic ≈256×
  });
});
