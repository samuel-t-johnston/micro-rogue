import { describe, it, expect } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { run as runCarveRooms } from './stage-carve-rooms.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

function carve(seed = 1, config = {}) {
  const level = createLevel();
  runRoomGridGeometry(level, config, level.blackboard, createRng(seed));
  runCarveRooms(level, {}, level.blackboard, createRng(seed));
  return level;
}

// Count connected components of floor tiles (4-adjacency).
function floorComponents(level) {
  const key = (x, y) => `${x},${y}`;
  const floor = new Set();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) if (level.tiles[y][x] === 'floor') floor.add(key(x, y));
  }
  const seen = new Set();
  let components = 0;
  for (const start of floor) {
    if (seen.has(start)) continue;
    components++;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const k = key(x + dx, y + dy);
        if (floor.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
  }
  return components;
}

describe('carve-rooms stage', () => {
  it('sizes the level from the grid', () => {
    const level = carve(1);
    expect(level.width).toBe(30); // 3 cols * 10
    expect(level.height).toBe(30);
  });

  it('leaves a wall border around the level', () => {
    const level = carve(1);
    for (let x = 0; x < level.width; x++) {
      expect(level.tiles[0][x]).toBe('wall');
      expect(level.tiles[level.height - 1][x]).toBe('wall');
    }
    for (let y = 0; y < level.height; y++) {
      expect(level.tiles[y][0]).toBe('wall');
      expect(level.tiles[y][level.width - 1]).toBe('wall');
    }
  });

  it('carves exactly one floor component per zone (merges joined, gutters separate)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const level = carve(seed);
      const zones = level.blackboard['level:zones'];
      expect(floorComponents(level)).toBe(zones.length);
    }
  });

  it('records a room rect per cell with at least the 2x2 minimum floor', () => {
    const level = carve(1);
    const rooms = level.blackboard['level:rooms'];
    const cellCount = level.blackboard['level:zones'].reduce((n, z) => n + z.cells.length, 0);
    expect(Object.keys(rooms)).toHaveLength(cellCount);
    for (const r of Object.values(rooms)) {
      expect(r.x1 - r.x0 + 1).toBeGreaterThanOrEqual(2);
      expect(r.y1 - r.y0 + 1).toBeGreaterThanOrEqual(2);
    }
  });

  it('varies room sizes across seeds', () => {
    const floorCount = (lvl) => lvl.tiles.flat().filter((t) => t === 'floor').length;
    const counts = new Set();
    for (let s = 1; s <= 10; s++) counts.add(floorCount(carve(s)));
    expect(counts.size).toBeGreaterThan(1);
  });

  it('is deterministic for a given seed', () => {
    expect(carve(7).tiles).toEqual(carve(7).tiles);
  });
});
