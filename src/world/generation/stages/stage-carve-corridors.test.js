import { describe, it, expect } from 'vitest';
import { run as runLayoutNodes } from './stage-layout-nodes.js';
import { run as runLayoutEdges } from './stage-layout-edges.js';
import { run as runCarveChambers } from './stage-carve-chambers.js';
import { run as runCarveCorridors } from './stage-carve-corridors.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

// The whole walker pipeline on one shared rng stream, like the real runner.
function generate(seed, nodeConfig = { width: 48, height: 32, nodeCount: 10 }) {
  const level = createLevel();
  const bb = level.blackboard;
  const rng = createRng(seed);
  runLayoutNodes(level, nodeConfig, bb, rng);
  runLayoutEdges(level, {}, bb, rng);
  runCarveChambers(level, {}, bb, rng);
  runCarveCorridors(level, {}, bb, rng);
  return { level, bb };
}

// True if every node centre is reachable over floor tiles from node 0's centre.
function chambersConnected(level, bb) {
  const nodes = bb['level:nodes'];
  const floor = (x, y) => level.getTile(x, y) === 'floor';
  const seen = new Set([`${nodes[0].x},${nodes[0].y}`]);
  const stack = [[nodes[0].x, nodes[0].y]];
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
  return nodes.every((n) => seen.has(`${n.x},${n.y}`));
}

describe('carveCorridors stage', () => {
  it('joins two injected chambers with a corridor', () => {
    const level = createLevel();
    const bb = level.blackboard;
    const rng = createRng(1);
    bb['level:nodes'] = [
      { id: 0, x: 8, y: 8, radius: 3 },
      { id: 1, x: 34, y: 22, radius: 3 },
    ];
    bb['level:bounds'] = { x: 0, y: 0, w: 44, h: 30 };
    bb['level:edges'] = [{ a: 0, b: 1, kind: 'mst' }];
    runCarveChambers(level, {}, bb, rng);
    runCarveCorridors(level, {}, bb, rng);
    expect(chambersConnected(level, bb)).toBe(true);
  });

  it('produces a fully connected level across many seeds (arrival is guaranteed)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { level, bb } = generate(seed);
      expect(chambersConnected(level, bb)).toBe(true);
    }
  });

  it('creates no zones — corridors are non-zone tiles', () => {
    const { bb } = generate(3);
    expect(bb['level:zones']).toHaveLength(bb['level:nodes'].length);
    expect(bb['level:zones'].every((z) => z.kind === 'chamber')).toBe(true);
  });

  it('records a link and an adjacency pair per edge', () => {
    const { bb } = generate(3);
    const edgeCount = bb['level:edges'].length;
    expect(bb['level:links']).toHaveLength(edgeCount);
    expect(bb['level:adjacency']).toHaveLength(edgeCount);
    for (const l of bb['level:links']) expect(l.a).toBeLessThan(l.b);
  });

  it('is deterministic for a given seed', () => {
    expect(generate(5).level.tiles).toEqual(generate(5).level.tiles);
  });
});
