import { describe, it, expect, vi } from 'vitest';
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

// A protected static block (left) beside a random room (right). The block's whole footprint is
// protected, so stitch may only join it through an authored connector — a floor opening in its wall.
function blockAndRoom({ connector = true } = {}) {
  const w = 15;
  const h = 9;
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  const fill = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
  };
  fill(1, 1, 5, 7); // left block interior
  fill(9, 1, 13, 7); // right room
  const room = (x0, y0, x1, y1) => {
    const t = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push([x, y]);
    return t;
  };
  level.blackboard['level:zones'] = [
    { id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
    { id: 1, cells: [[1, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
  ];
  level.blackboard['level:rooms'] = {
    '0,0': { tiles: room(1, 1, 5, 7) },
    '1,0': { tiles: room(9, 1, 13, 7) },
  };
  level.blackboard['level:protected'] = [{ x: 0, y: 0, w: 7, h: 9 }]; // covers the left block + walls
  if (connector) {
    level.tiles[4][6] = 'floor'; // author opens the east wall at (6,4)
    level.blackboard['level:connectors'] = [[6, 4]];
  }
  return level;
}

describe('stitch with connectors and a protected footprint', () => {
  it('joins the block only through its connector, leaving the block otherwise untouched', () => {
    const level = blockAndRoom();
    const reg = stitch(level, { maxConnections: 1 });

    expect(connected(level)).toBe(true);
    // The corridor runs from the connector (6,4) into the exterior gap on that row.
    expect(level.tiles[4][7]).toBe('floor');
    expect(level.tiles[4][8]).toBe('floor');
    // The block's own walls are never cut — only the authored opening at (6,4) breaches it.
    expect(level.tiles[3][6]).toBe('wall');
    expect(level.tiles[5][6]).toBe('wall');
    expect(level.tiles[1][7]).toBe('wall');
    // Static owns its door treatment, so stitch drops no door on a connector join.
    expect(reg.getEntitiesWith('openable').length).toBe(0);
  });

  it('leaves a protected block with no connector sealed (never carves into it)', () => {
    const level = blockAndRoom({ connector: false });
    stitch(level, { maxConnections: 1 });
    expect(connected(level)).toBe(false); // no authorized way in, so it stays its own component
    expect(level.tiles[4][6]).toBe('wall'); // wall never opened
    expect(level.tiles[4][7]).toBe('wall'); // nothing carved toward it
  });

  it('routes around a protected block when the connector faces the wrong way (>2 segments)', () => {
    // A protected block (cols 4–10, rows 3–7) with its only connector on the WEST face at (4,5); the
    // room it must reach is due EAST at (12,5). A straight/L corridor would cut through the block, so
    // stitch must route up over the top (or under) — three-plus segments.
    const w = 15;
    const h = 11;
    const level = createLevel();
    level.width = w;
    level.height = h;
    level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
    const fill = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
    };
    const room = (x0, y0, x1, y1) => {
      const t = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push([x, y]);
      return t;
    };
    fill(5, 4, 9, 6); // block interior
    fill(12, 4, 13, 6); // east room
    level.tiles[5][4] = 'floor'; // open the block's WEST wall at (4,5) — the connector
    level.blackboard['level:zones'] = [
      { id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
      { id: 1, cells: [[1, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
    ];
    level.blackboard['level:rooms'] = {
      '0,0': { tiles: room(5, 4, 9, 6) },
      '1,0': { tiles: room(12, 4, 13, 6) },
    };
    level.blackboard['level:protected'] = [{ x: 4, y: 3, w: 7, h: 5 }];
    level.blackboard['level:connectors'] = [[4, 5]];

    stitch(level, {});
    expect(connected(level)).toBe(true);
    expect(level.tiles[5][10]).toBe('wall'); // never tunnelled straight through the block
    expect(level.tiles[3][5]).toBe('wall'); // block's own walls intact
  });

  it('warns (and leaves it disconnected) when a connector has no carvable route out', () => {
    // The protected block spans the full height, so its west-face connector is boxed in — there is no
    // way around it to the east room.
    const w = 9;
    const h = 5;
    const level = createLevel();
    level.width = w;
    level.height = h;
    level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
    const fill = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
    };
    const room = (x0, y0, x1, y1) => {
      const t = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push([x, y]);
      return t;
    };
    fill(2, 1, 3, 3); // block interior
    fill(6, 1, 7, 3); // east room
    level.tiles[2][1] = 'floor'; // open west wall at (1,2)
    level.blackboard['level:zones'] = [
      { id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
      { id: 1, cells: [[1, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
    ];
    level.blackboard['level:rooms'] = {
      '0,0': { tiles: room(2, 1, 3, 3) },
      '1,0': { tiles: room(6, 1, 7, 3) },
    };
    level.blackboard['level:protected'] = [{ x: 1, y: 0, w: 4, h: 5 }]; // spans full height
    level.blackboard['level:connectors'] = [[1, 2]];

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stitch(level, {});
    expect(connected(level)).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/unjoined|route/i));
    warn.mockRestore();
  });
});
