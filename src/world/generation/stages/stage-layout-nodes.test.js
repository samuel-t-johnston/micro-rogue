import { describe, it, expect } from 'vitest';
import { run as runLayoutNodes } from './stage-layout-nodes.js';
import { createRng } from '../../../engine/core/rng.js';

function layout(config = {}, seed = 1) {
  const bb = {};
  runLayoutNodes(null, config, bb, createRng(seed));
  return bb['level:nodes'];
}

const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

describe('layoutNodes stage', () => {
  it('places at most nodeCount nodes, each with an id, position, and radius', () => {
    const nodes = layout({ width: 48, height: 32, nodeCount: 12, radius: [2, 6] });
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.length).toBeLessThanOrEqual(12);
    nodes.forEach((n, i) => {
      expect(n.id).toBe(i);
      expect(Number.isInteger(n.x)).toBe(true);
      expect(Number.isInteger(n.y)).toBe(true);
      expect(n.radius).toBeGreaterThanOrEqual(2);
      expect(n.radius).toBeLessThanOrEqual(6);
    });
  });

  it('keeps every chamber (centre ± radius) inside the bounds wall ring', () => {
    const nodes = layout({ width: 48, height: 32, nodeCount: 14, radius: [2, 6] });
    for (const n of nodes) {
      expect(n.x - n.radius).toBeGreaterThanOrEqual(1);
      expect(n.y - n.radius).toBeGreaterThanOrEqual(1);
      expect(n.x + n.radius).toBeLessThanOrEqual(46);
      expect(n.y + n.radius).toBeLessThanOrEqual(30);
    }
  });

  it('separates node centres by at least minSeparation', () => {
    const minSeparation = 14;
    const nodes = layout({ width: 60, height: 40, nodeCount: 14, radius: [2, 6], minSeparation });
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        expect(sqDist(nodes[i], nodes[j])).toBeGreaterThanOrEqual(minSeparation ** 2);
  });

  it('draws radii across the whole range (both small and large appear)', () => {
    const nodes = layout({
      width: 120,
      height: 120,
      nodeCount: 60,
      radius: [2, 6],
      minSeparation: 6,
    });
    expect(nodes.some((n) => n.radius <= 3)).toBe(true);
    expect(nodes.some((n) => n.radius >= 5)).toBe(true);
  });

  it('confines nodes to an embedded bounds sub-rect', () => {
    const bounds = { x: 20, y: 10, w: 24, h: 18 };
    const nodes = layout({ bounds, nodeCount: 8, radius: [2, 4] });
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(bounds.x);
      expect(n.x).toBeLessThanOrEqual(bounds.x + bounds.w - 1);
      expect(n.y).toBeGreaterThanOrEqual(bounds.y);
      expect(n.y).toBeLessThanOrEqual(bounds.y + bounds.h - 1);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = layout({ nodeCount: 12 }, 42);
    const b = layout({ nodeCount: 12 }, 42);
    expect(a).toEqual(b);
  });
});
