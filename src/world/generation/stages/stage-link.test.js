import { describe, it, expect } from 'vitest';
import { run as runLink } from './stage-link.js';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { createRng } from '../../../engine/core/rng.js';

const zonesOf = (ids) => ids.map((id) => ({ id }));

function linkGraph(zones, adjacency, seed = 1, config = {}) {
  const bb = { 'level:zones': zones, 'level:adjacency': adjacency };
  runLink(null, config, bb, createRng(seed));
  return bb['level:links'];
}

function connectedByLinks(zones, links) {
  if (zones.length <= 1) return true;
  const nb = new Map(zones.map((z) => [z.id, []]));
  for (const { a, b } of links) {
    nb.get(a).push(b);
    nb.get(b).push(a);
  }
  const seen = new Set([zones[0].id]);
  const stack = [zones[0].id];
  while (stack.length) {
    for (const n of nb.get(stack.pop()))
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
  }
  return seen.size === zones.length;
}

// A 4-cycle: spanning tree uses 3 of the 4 edges, leaving one for an optional loop link.
const CYCLE = {
  zones: zonesOf([0, 1, 2, 3]),
  adj: [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 3],
  ],
};

describe('link stage', () => {
  it('with no extra links, produces exactly a connected spanning tree', () => {
    const links = linkGraph(CYCLE.zones, CYCLE.adj, 1, { extraLinkChance: 0 });
    expect(links).toHaveLength(CYCLE.zones.length - 1); // 3
    expect(connectedByLinks(CYCLE.zones, links)).toBe(true);
  });

  it('adds every adjacency edge when the chance is 1 and the cap is lifted', () => {
    const links = linkGraph(CYCLE.zones, CYCLE.adj, 1, { extraLinkChance: 1, maxExtraDegree: 99 });
    expect(links).toHaveLength(CYCLE.adj.length); // 4
  });

  it('emits ordered ids with a < b, every link drawn from adjacency', () => {
    const links = linkGraph(CYCLE.zones, CYCLE.adj, 3);
    links.forEach((l, i) => {
      expect(l.id).toBe(i);
      expect(l.a).toBeLessThan(l.b);
      expect(CYCLE.adj.some(([x, y]) => x === l.a && y === l.b)).toBe(true);
    });
  });

  it('is deterministic for a given seed', () => {
    expect(linkGraph(zonesOf([0, 1, 2, 3]), CYCLE.adj, 7)).toEqual(
      linkGraph(zonesOf([0, 1, 2, 3]), CYCLE.adj, 7),
    );
  });

  it('connects every zone of a real generated layout, drawing only from adjacency', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const bb = {};
      runRoomGridGeometry(null, {}, bb, createRng(seed));
      runLink(null, {}, bb, createRng(seed));
      const { 'level:zones': zones, 'level:adjacency': adj, 'level:links': links } = bb;
      expect(connectedByLinks(zones, links)).toBe(true);
      expect(links.length).toBeGreaterThanOrEqual(zones.length - 1);
      const adjSet = new Set(adj.map(([a, b]) => `${a},${b}`));
      for (const { a, b } of links) expect(adjSet.has(`${a},${b}`)).toBe(true);
    }
  });

  it('the soft degree cap limits extra links versus an uncapped run', () => {
    let anyStrictlyFewer = false;
    for (let seed = 1; seed <= 30; seed++) {
      const bb = {};
      runRoomGridGeometry(null, {}, bb, createRng(seed));
      const zones = bb['level:zones'];
      const adj = bb['level:adjacency'];
      const capped = linkGraph(zones, adj, seed, { extraLinkChance: 1, maxExtraDegree: 2 });
      const uncapped = linkGraph(zones, adj, seed, { extraLinkChance: 1, maxExtraDegree: 99 });
      expect(capped.length).toBeLessThanOrEqual(uncapped.length);
      if (capped.length < uncapped.length) anyStrictlyFewer = true;
    }
    expect(anyStrictlyFewer).toBe(true); // the cap actually holds some loops back
  });
});
