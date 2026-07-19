import { describe, it, expect } from 'vitest';
import { run as runLayoutEdges, segmentsCross } from './stage-layout-edges.js';

// Nodes only need positions for the graph; radius is irrelevant here.
const N = (id, x, y) => ({ id, x, y });

function edges(nodes, config = {}) {
  const bb = { 'level:nodes': nodes };
  runLayoutEdges(null, config, bb);
  return bb['level:edges'];
}

// Every node reachable from node 0 over the edge set.
function connected(nodes, es) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of es) {
    adj.get(e.a).push(e.b);
    adj.get(e.b).push(e.a);
  }
  const seen = new Set([nodes[0].id]);
  const stack = [nodes[0].id];
  while (stack.length)
    for (const nb of adj.get(stack.pop())) if (!seen.has(nb)) (seen.add(nb), stack.push(nb));
  return seen.size === nodes.length;
}

// True if any two edges that don't share an endpoint properly cross.
function anyCrossing(nodes, es) {
  const at = (i) => nodes.find((n) => n.id === i);
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      const e = es[i];
      const f = es[j];
      if (e.a === f.a || e.a === f.b || e.b === f.a || e.b === f.b) continue;
      if (segmentsCross(at(e.a), at(e.b), at(f.a), at(f.b))) return true;
    }
  return false;
}

describe('segmentsCross', () => {
  it('detects a proper crossing', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(
      true,
    );
  });
  it('returns false for disjoint segments', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 5 })).toBe(
      false,
    );
  });
  it('treats a shared endpoint as non-crossing', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(
      false,
    );
  });
  it('treats a collinear touch as non-crossing', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBe(
      false,
    );
  });
});

describe('layoutEdges stage', () => {
  const five = [N(0, 0, 0), N(1, 10, 0), N(2, 5, 8), N(3, 15, 8), N(4, 20, 0)];

  it('builds a spanning tree that connects every node', () => {
    const es = edges(five, { loopFactor: 0 });
    const mst = es.filter((e) => e.kind === 'mst');
    expect(mst).toHaveLength(five.length - 1);
    expect(es.every((e) => e.kind === 'mst')).toBe(true); // loopFactor 0 ⇒ a pure tree
    expect(connected(five, es)).toBe(true);
  });

  it('adds the complete graph as loops when only one non-tree edge exists (triangle)', () => {
    const tri = [N(0, 0, 0), N(1, 10, 0), N(2, 5, 8)];
    const es = edges(tri, { loopFactor: 1 });
    expect(es).toHaveLength(3); // 2 tree + 1 loop = complete
    expect(es.filter((e) => e.kind === 'loop')).toHaveLength(1);
  });

  it('rejects a loop that would cross an existing edge (square diagonals)', () => {
    const square = [N(0, 0, 0), N(1, 10, 0), N(2, 10, 10), N(3, 0, 10)];
    const es = edges(square, { loopFactor: 1 });
    expect(anyCrossing(square, es)).toBe(false);
    // The two diagonals cross each other, so at most one can be present.
    const diagonals = es.filter((e) => (e.a === 0 && e.b === 2) || (e.a === 1 && e.b === 3));
    expect(diagonals.length).toBeLessThanOrEqual(1);
  });

  it('produces no crossing edges on a larger graph', () => {
    const es = edges(five, { loopFactor: 0.5 });
    expect(anyCrossing(five, es)).toBe(false);
    expect(es.some((e) => e.kind === 'loop')).toBe(true); // loops are actually added
  });

  it('normalizes every edge to a<b and tags each mst or loop', () => {
    for (const e of edges(five, { loopFactor: 0.5 })) {
      expect(e.a).toBeLessThan(e.b);
      expect(['mst', 'loop']).toContain(e.kind);
    }
  });

  it('is deterministic', () => {
    expect(edges(five, { loopFactor: 0.5 })).toEqual(edges(five, { loopFactor: 0.5 }));
  });

  it('emits no edges for fewer than two nodes', () => {
    expect(edges([])).toEqual([]);
    expect(edges([N(0, 3, 3)])).toEqual([]);
  });
});
