import { describe, it, expect } from 'vitest';
import * as spiral from '../../../data/maps/maze-spiral.js';
import * as zigzag from '../../../data/maps/maze-zigzag.js';
import * as pillars from '../../../data/maps/maze-pillars.js';
import { ENTITY_PREFABS, prefabIdsByKind } from '../../world/entities/entity-prefabs.js';

const parse = (tiles) =>
  tiles
    .trim()
    .split('\n')
    .map((row) => [...row]);

// Reachable floor tiles from (sx, sy) via 4-way flood fill.
function floodFill(grid, sx, sy) {
  const h = grid.length;
  const w = grid[0].length;
  const seen = new Set();
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const key = `${x},${y}`;
    if (seen.has(key) || grid[y][x] !== '.') continue;
    seen.add(key);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

const MAPS = [
  { name: 'maze-spiral', mod: spiral },
  { name: 'maze-zigzag', mod: zigzag },
  { name: 'maze-pillars', mod: pillars },
];

// Derived from the prefab catalog, not hand-listed, so a roster change can't leave this stale.
const ITEM_TYPES = new Set(prefabIdsByKind('item'));

describe.each(MAPS)('$name', ({ mod }) => {
  const grid = parse(mod.tiles);

  it('is a 15x15 grid of legend characters', () => {
    expect(grid).toHaveLength(15);
    for (const row of grid) {
      expect(row).toHaveLength(15);
      for (const ch of row) expect(mod.legend[ch]).toBeTruthy();
    }
  });

  it('has all floor reachable from the up-stairs, including the down-stairs', () => {
    const up = mod.entities.find((e) => e.type === 'stairsUp');
    const down = mod.entities.find((e) => e.type === 'stairsDown');
    expect(up).toBeTruthy();
    expect(down).toBeTruthy();

    const reachable = floodFill(grid, up.x, up.y);
    const floorCount = grid.flat().filter((c) => c === '.').length;
    expect(reachable.size).toBe(floorCount); // single connected floor component
    expect(reachable.has(`${down.x},${down.y}`)).toBe(true);
  });

  it('places every entity on a distinct floor tile', () => {
    const seen = new Set();
    for (const e of mod.entities) {
      expect(grid[e.y][e.x]).toBe('.');
      const key = `${e.x},${e.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('carries exactly one up- and one down-stairs', () => {
    const count = (pred) => mod.entities.filter(pred).length;
    expect(count((e) => e.type === 'stairsUp')).toBe(1);
    expect(count((e) => e.type === 'stairsDown')).toBe(1);
  });

  // Structural, not roster-coupled: every authored type must resolve to a real prefab (a typo or a
  // removed type fails loudly), and the map must place at least one item.
  it('authors only resolvable prefab types, including at least one item', () => {
    for (const e of mod.entities) {
      expect(ENTITY_PREFABS[e.type], `unknown prefab type "${e.type}"`).toBeTruthy();
    }
    expect(mod.entities.some((e) => ITEM_TYPES.has(e.type))).toBe(true);
  });
});
