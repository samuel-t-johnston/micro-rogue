import { describe, it, expect } from 'vitest';
import { run as runStitch } from './stage-stitch.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createRng } from '../../../engine/core/rng.js';

// Two rooms in one walled box, separated by a wall seam — the two "sections" a composed pipeline
// leaves disconnected. Each room is a chamber zone; bounds cover the whole box.
function twoRooms(gapExtra = 0) {
  const w = 15 + gapExtra;
  const h = 9;
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  const fill = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
  };
  const rightX0 = 9 + gapExtra;
  fill(1, 1, 5, 7); // left room
  fill(rightX0, 1, w - 2, 7); // right room
  const room = (x0, y0, x1, y1) => {
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x, y]);
    return tiles;
  };
  // Deliberately leave a *stale* sub-rect in level:bounds (as a composed pipeline would, after its
  // last section) — stitch must ignore it and operate over the whole level.
  level.blackboard['level:bounds'] = { x: rightX0, y: 0, w: w - rightX0, h };
  level.blackboard['level:zones'] = [
    { id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
    { id: 1, cells: [[1, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
  ];
  level.blackboard['level:rooms'] = {
    '0,0': { tiles: room(1, 1, 5, 7) },
    '1,0': { tiles: room(rightX0, 1, w - 2, 7) },
  };
  return level;
}

function connected(level) {
  const floor = (x, y) => level.getTile(x, y) === 'floor';
  let start = null;
  for (let y = 0; y < level.height && !start; y++)
    for (let x = 0; x < level.width && !start; x++) if (floor(x, y)) start = [x, y];
  const seen = new Set([`${start[0]},${start[1]}`]);
  const stack = [start];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (floor(x + dx, y + dy) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  let total = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) if (floor(x, y)) total++;
  return seen.size === total;
}

const stitch = (level, config = {}) => {
  const reg = createEntityRegistry();
  runStitch(level, config, level.blackboard, createRng(1), reg);
  return reg;
};

describe('stitch stage', () => {
  it('connects two separate sections (at least one connection)', () => {
    const level = twoRooms();
    expect(connected(level)).toBe(false);
    stitch(level, { maxConnections: 1 });
    expect(connected(level)).toBe(true);
    expect(level.blackboard['level:adjacency']).toContainEqual([0, 1]);
  });

  it('drops a door on each connection', () => {
    const level = twoRooms();
    const reg = stitch(level, { maxConnections: 1 });
    expect(reg.getEntitiesWith('openable').length).toBe(1);
  });

  it('makes multiple separate connections up to maxConnections', () => {
    const level = twoRooms();
    const reg = stitch(level, { maxConnections: 3, spacing: 1 });
    // Tall rooms with a narrow gap admit several parallel connections; each gets a door.
    const doors = reg.getEntitiesWith('openable').length;
    expect(doors).toBeGreaterThan(1);
    expect(doors).toBeLessThanOrEqual(3);
    expect(connected(level)).toBe(true);
  });

  it('guarantees connectivity even when the gap exceeds maxGap (fallback)', () => {
    const level = twoRooms(6); // a wider gap than the default maxGap
    stitch(level, { maxConnections: 1, maxGap: 2 });
    expect(connected(level)).toBe(true);
  });

  it('does nothing to an already-connected level', () => {
    const level = twoRooms();
    stitch(level, { maxConnections: 1 }); // connect
    const reg2 = stitch(level, { maxConnections: 1 }); // second run: already one component
    expect(reg2.getEntitiesWith('openable').length).toBe(0);
  });

  it('is deterministic', () => {
    const a = twoRooms();
    const b = twoRooms();
    stitch(a, { maxConnections: 3 });
    stitch(b, { maxConnections: 3 });
    expect(a.tiles).toEqual(b.tiles);
  });
});
