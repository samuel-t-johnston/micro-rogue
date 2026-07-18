import { describe, it, expect } from 'vitest';
import { run as runCarveChambers } from './stage-carve-chambers.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

// Inject a node plan directly — decoupled from layoutNodes.
function carve(nodes, bounds = { x: 0, y: 0, w: 40, h: 30 }, seed = 1, level = createLevel()) {
  const bb = level.blackboard;
  bb['level:nodes'] = nodes;
  bb['level:bounds'] = bounds;
  runCarveChambers(level, {}, bb, createRng(seed));
  return { level, bb };
}

const cheb = (x, y, n) => Math.max(Math.abs(x - n.x), Math.abs(y - n.y));

describe('carveChambers stage', () => {
  const nodes = [
    { id: 0, x: 10, y: 10, radius: 4 },
    { id: 1, x: 28, y: 20, radius: 3 },
  ];

  it('sizes and wall-fills a standalone grid, then carves chamber floor', () => {
    const { level } = carve(nodes);
    expect(level.width).toBe(40);
    expect(level.height).toBe(30);
    // The node centre is floor; a far corner is untouched wall.
    expect(level.getTile(10, 10)).toBe('floor');
    expect(level.getTile(0, 0)).toBe('wall');
  });

  it('emits one tagged chamber zone and a tile-set room per node', () => {
    const { bb } = carve(nodes);
    const zones = bb['level:zones'];
    const rooms = bb['level:rooms'];
    expect(zones).toHaveLength(2);
    for (const z of zones) {
      expect(z.kind).toBe('chamber');
      expect(z.origin).toBe('tagged');
      expect(z.labels).toEqual(['room']);
      const room = rooms[`${z.id},0`];
      expect(room.tiles.length).toBeGreaterThan(0);
    }
  });

  it('anchors each room core on the node centre, and the core is floor', () => {
    const { level, bb } = carve(nodes);
    for (const n of nodes) {
      const room = bb['level:rooms'][`${n.id},0`];
      expect(room.core).toEqual([n.x, n.y]);
      expect(level.getTile(n.x, n.y)).toBe('floor');
    }
  });

  it('keeps every chamber tile within its radius and connected to the core', () => {
    const { bb } = carve(nodes);
    for (const n of nodes) {
      const tiles = bb['level:rooms'][`${n.id},0`].tiles;
      for (const [x, y] of tiles) expect(cheb(x, y, n)).toBeLessThanOrEqual(n.radius);
      // The tile set is 4-connected (flood from the core reaches all of it).
      const set = new Set(tiles.map(([x, y]) => `${x},${y}`));
      const seen = new Set([`${n.x},${n.y}`]);
      const stack = [[n.x, n.y]];
      while (stack.length) {
        const [x, y] = stack.pop();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const k = `${x + dx},${y + dy}`;
          if (set.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([x + dx, y + dy]);
          }
        }
      }
      expect(seen.size).toBe(set.size);
    }
  });

  it('carves in place without resizing an existing (embedded) grid', () => {
    const level = createLevel();
    level.width = 40;
    level.height = 30;
    level.tiles = Array.from({ length: 30 }, () => Array.from({ length: 40 }, () => 'wall'));
    carve([{ id: 0, x: 10, y: 10, radius: 3 }], { x: 0, y: 0, w: 40, h: 30 }, 1, level);
    expect(level.width).toBe(40);
    expect(level.getTile(10, 10)).toBe('floor');
  });

  it('is deterministic for a given seed', () => {
    const a = carve(nodes, undefined, 7).bb['level:rooms'];
    const b = carve(nodes, undefined, 7).bb['level:rooms'];
    expect(a).toEqual(b);
  });
});
