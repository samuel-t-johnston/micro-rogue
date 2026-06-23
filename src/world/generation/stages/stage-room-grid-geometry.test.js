import { describe, it, expect } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { createRng } from '../../../engine/rng.js';

// Runs the stage against a fresh blackboard and returns it.
function generate(seed = 123, config = {}) {
  const blackboard = {};
  runRoomGridGeometry(null, config, blackboard, createRng(seed));
  return blackboard;
}

// True if the adjacency list connects every zone into one component.
function isConnected(zones, adjacency) {
  if (zones.length === 0) return true;
  const neighbors = new Map(zones.map((z) => [z.id, []]));
  for (const [a, b] of adjacency) {
    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
  }
  const seen = new Set([zones[0].id]);
  const stack = [zones[0].id];
  while (stack.length) {
    for (const n of neighbors.get(stack.pop())) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === zones.length;
}

describe('room-grid geometry stage', () => {
  it('deletes one cell and merges two: 7 zones over 8 cells on a 3x3 grid', () => {
    const { 'level:zones': zones } = generate();
    expect(zones).toHaveLength(7); // 9 - 1 deleted - 1 merged
    const totalCells = zones.reduce((n, z) => n + z.cells.length, 0);
    expect(totalCells).toBe(8); // 9 - 1 deleted
  });

  it('produces exactly one double zone; the rest are single cells', () => {
    const { 'level:zones': zones } = generate();
    const sizes = zones.map((z) => z.cells.length).sort();
    expect(sizes).toEqual([1, 1, 1, 1, 1, 1, 2]);
  });

  it('labels every zone "room"', () => {
    const { 'level:zones': zones } = generate();
    for (const z of zones) expect(z.labels).toContain('room');
  });

  it('derives each zone rect from its cells in tile space', () => {
    const { 'level:zones': zones, 'level:grid': grid } = generate();
    const cs = grid.cellSize;
    for (const z of zones) {
      if (z.cells.length === 1) {
        expect(z.rect).toMatchObject({ w: cs, h: cs });
      } else {
        // A merged (two-cell) zone spans 2x the cell size along exactly one axis.
        const spans2x1 =
          (z.rect.w === cs * 2 && z.rect.h === cs) || (z.rect.w === cs && z.rect.h === cs * 2);
        expect(spans2x1).toBe(true);
      }
      // Rect origin matches the top-left cell.
      const minC = Math.min(...z.cells.map((c) => c[0]));
      const minR = Math.min(...z.cells.map((c) => c[1]));
      expect(z.rect).toMatchObject({ x: minC * cs, y: minR * cs });
    }
  });

  it('emits adjacency that references only real zones and forms one connected graph', () => {
    const { 'level:zones': zones, 'level:adjacency': adjacency } = generate();
    const ids = new Set(zones.map((z) => z.id));
    for (const [a, b] of adjacency) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
      expect(a).toBeLessThan(b); // deduped, ordered
    }
    expect(isConnected(zones, adjacency)).toBe(true);
  });

  it('honours cols/rows/cellSize parameters', () => {
    const { 'level:zones': zones, 'level:grid': grid } = generate(123, {
      cols: 4,
      rows: 4,
      cellSize: 8,
    });
    expect(grid).toEqual({ cols: 4, rows: 4, cellSize: 8 });
    expect(zones).toHaveLength(14); // 16 - 1 deleted - 1 merged
    expect(zones.reduce((n, z) => n + z.cells.length, 0)).toBe(15);
    for (const z of zones) expect(z.rect.w % 8).toBe(0); // rects sized in the custom cell units
  });

  it('keeps the graph connected across multiple deletes, with no isolated zone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { 'level:zones': zones, 'level:adjacency': adjacency } = generate(seed, { deletes: 3 });
      expect(isConnected(zones, adjacency)).toBe(true);
      const degree = new Map(zones.map((z) => [z.id, 0]));
      for (const [a, b] of adjacency) {
        degree.set(a, degree.get(a) + 1);
        degree.set(b, degree.get(b) + 1);
      }
      for (const z of zones) expect(degree.get(z.id)).toBeGreaterThan(0); // never isolated
    }
  });

  it('reduces zone count by the number of merges (cells conserved)', () => {
    const { 'level:zones': zones } = generate(123, { deletes: 1, merges: 3 });
    expect(zones).toHaveLength(5); // 9 - 1 deleted - 3 merged
    expect(zones.reduce((n, z) => n + z.cells.length, 0)).toBe(8);
  });

  it('can grow a zone past two cells (option B polyominoes)', () => {
    const maxSizes = [1, 2, 3, 4, 5, 6, 7, 8].map((s) =>
      Math.max(...generate(s, { merges: 3 })['level:zones'].map((z) => z.cells.length)),
    );
    expect(Math.max(...maxSizes)).toBeGreaterThanOrEqual(3);
  });

  it('stops merging at minZones', () => {
    const { 'level:zones': zones } = generate(123, { merges: 10, minZones: 4 });
    expect(zones).toHaveLength(4);
  });

  it('is deterministic for a given seed', () => {
    expect(generate(777)).toEqual(generate(777));
    expect(generate(777, { deletes: 2, merges: 2 })).toEqual(
      generate(777, { deletes: 2, merges: 2 }),
    );
  });

  it('different seeds can produce different layouts', () => {
    const layouts = [1, 2, 3, 4, 5].map((s) => JSON.stringify(generate(s)['level:zones']));
    expect(new Set(layouts).size).toBeGreaterThan(1);
  });
});
