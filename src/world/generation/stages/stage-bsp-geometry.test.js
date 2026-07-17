import { describe, it, expect } from 'vitest';
import { run as bspGeometry } from './stage-bsp-geometry.js';
import {
  LEVEL_ZONES,
  LEVEL_ROOMS,
  LEVEL_ADJACENCY,
  LEVEL_LINKS,
  LEVEL_BSP,
} from '../blackboard-keys.js';
import { createRng } from '../../../engine/core/rng.js';

// Runs the stage against a fresh blackboard and returns it. The stage never touches `level`.
function plan(config, seed = 1) {
  const blackboard = {};
  bspGeometry({}, config, blackboard, createRng(seed));
  return blackboard;
}

describe('stage-bsp-geometry', () => {
  it('is deterministic for a given seed', () => {
    const a = plan({ width: 40, height: 30, minRoomSize: 5 }, 7);
    const b = plan({ width: 40, height: 30, minRoomSize: 5 }, 7);
    expect(b[LEVEL_ZONES]).toEqual(a[LEVEL_ZONES]);
    expect(b[LEVEL_ROOMS]).toEqual(a[LEVEL_ROOMS]);
    expect(b[LEVEL_LINKS]).toEqual(a[LEVEL_LINKS]);
    expect(b[LEVEL_BSP]).toEqual(a[LEVEL_BSP]);
  });

  it('produces more than one room on a large map', () => {
    const zones = plan({ width: 48, height: 32 }, 3)[LEVEL_ZONES];
    expect(zones.length).toBeGreaterThan(1);
  });

  it('every room meets the wall-inclusive minimum footprint on both axes', () => {
    const minRoomSize = 6;
    const zones = plan({ width: 50, height: 40, minRoomSize }, 11)[LEVEL_ZONES];
    for (const z of zones) {
      expect(z.rect.w).toBeGreaterThanOrEqual(minRoomSize);
      expect(z.rect.h).toBeGreaterThanOrEqual(minRoomSize);
    }
  });

  it('keeps every room inside the map bounds', () => {
    const w = 44;
    const h = 36;
    const zones = plan({ width: w, height: h }, 5)[LEVEL_ZONES];
    for (const z of zones) {
      expect(z.rect.x).toBeGreaterThanOrEqual(0);
      expect(z.rect.y).toBeGreaterThanOrEqual(0);
      expect(z.rect.x + z.rect.w).toBeLessThanOrEqual(w);
      expect(z.rect.y + z.rect.h).toBeLessThanOrEqual(h);
    }
  });

  it('gives each zone the reuse contract shape (single synthetic cell + matching room rect)', () => {
    const bb = plan({ width: 40, height: 30 }, 2);
    for (const z of bb[LEVEL_ZONES]) {
      expect(z.cells).toEqual([[z.id, 0]]);
      expect(z.labels).toEqual(['room']);
      const room = bb[LEVEL_ROOMS][`${z.id},0`];
      expect(room).toBeDefined();
      // floor interior sits one tile inside the outer rect's wall ring
      expect(room.x0).toBe(z.rect.x + 1);
      expect(room.y0).toBe(z.rect.y + 1);
      expect(room.x1).toBe(z.rect.x + z.rect.w - 2);
      expect(room.y1).toBe(z.rect.y + z.rect.h - 2);
    }
  });

  it('room floor interiors never overlap', () => {
    const rooms = Object.values(plan({ width: 50, height: 40 }, 9)[LEVEL_ROOMS]);
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        const disjoint = a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0;
        expect(disjoint).toBe(true);
      }
    }
  });

  it('links form a spanning tree over the rooms (connected, n-1 edges)', () => {
    const bb = plan({ width: 48, height: 32 }, 4);
    const zones = bb[LEVEL_ZONES];
    const links = bb[LEVEL_LINKS];
    expect(links.length).toBe(zones.length - 1);

    const parent = new Map(zones.map((z) => [z.id, z.id]));
    const find = (x) => (parent.get(x) === x ? x : find(parent.get(x)));
    for (const { a, b } of links) parent.set(find(a), find(b));
    const roots = new Set(zones.map((z) => find(z.id)));
    expect(roots.size).toBe(1);
  });

  it('every link is a real wall adjacency', () => {
    const bb = plan({ width: 48, height: 32 }, 6);
    const adj = new Set(bb[LEVEL_ADJACENCY].map(([a, b]) => `${a},${b}`));
    for (const { a, b } of bb[LEVEL_LINKS]) {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      expect(adj.has(key)).toBe(true);
    }
  });

  it('places every room-to-room gap on the shared wall, strictly interior to both (never a corner)', () => {
    const bb = plan({ width: 50, height: 40 }, 8);
    const rooms = bb[LEVEL_ROOMS];
    const roomPairs = bb[LEVEL_BSP].connections.filter((c) => c.rooms.length === 2);
    expect(roomPairs.length).toBeGreaterThan(0);
    for (const conn of roomPairs) {
      const a = rooms[`${conn.rooms[0]},0`];
      const b = rooms[`${conn.rooms[1]},0`];
      const [gx, gy] = conn.gap;
      const vertical = a.x1 + 2 === b.x0 || b.x1 + 2 === a.x0;
      if (vertical) {
        expect([a.x1, b.x1]).toContain(gx - 1); // one room's floor ends at the wall
        expect([a.x0, b.x0]).toContain(gx + 1); // the other's begins past it
        expect(gy).toBeGreaterThanOrEqual(Math.max(a.y0, b.y0));
        expect(gy).toBeLessThanOrEqual(Math.min(a.y1, b.y1));
      } else {
        expect([a.y1, b.y1]).toContain(gy - 1);
        expect([a.y0, b.y0]).toContain(gy + 1);
        expect(gx).toBeGreaterThanOrEqual(Math.max(a.x0, b.x0));
        expect(gx).toBeLessThanOrEqual(Math.min(a.x1, b.x1));
      }
    }
  });

  it('offsets all geometry by an explicit bounds rect', () => {
    const bounds = { x: 10, y: 6, w: 30, h: 24 };
    const bb = plan({ bounds }, 5);
    for (const z of bb[LEVEL_ZONES]) {
      expect(z.rect.x).toBeGreaterThanOrEqual(bounds.x);
      expect(z.rect.y).toBeGreaterThanOrEqual(bounds.y);
      expect(z.rect.x + z.rect.w).toBeLessThanOrEqual(bounds.x + bounds.w);
      expect(z.rect.y + z.rect.h).toBeLessThanOrEqual(bounds.y + bounds.h);
    }
    expect(bb[LEVEL_BSP].bounds).toEqual(bounds);
  });

  it('yields a single room with no connections when the space is too small to split', () => {
    const bb = plan({ width: 5, height: 5, minRoomSize: 5 }, 1);
    expect(bb[LEVEL_ZONES]).toHaveLength(1);
    expect(bb[LEVEL_LINKS]).toHaveLength(0);
    expect(bb[LEVEL_BSP].connections).toHaveLength(0);
  });
});

describe('stage-bsp-geometry with halls', () => {
  const hallCfg = { width: 60, height: 44, minRoomSize: 6, includeHalls: true, hallWidth: 1 };

  it('is deterministic for a given seed', () => {
    const a = plan(hallCfg, 4);
    const b = plan(hallCfg, 4);
    expect(b[LEVEL_BSP]).toEqual(a[LEVEL_BSP]);
    expect(b[LEVEL_ROOMS]).toEqual(a[LEVEL_ROOMS]);
  });

  it('produces hall strips', () => {
    expect(plan(hallCfg, 2)[LEVEL_BSP].halls.length).toBeGreaterThan(0);
  });

  it('every room meets the minimum footprint', () => {
    const zones = plan(hallCfg, 7)[LEVEL_ZONES];
    expect(zones.length).toBeGreaterThan(1);
    for (const z of zones) {
      expect(z.rect.w).toBeGreaterThanOrEqual(hallCfg.minRoomSize);
      expect(z.rect.h).toBeGreaterThanOrEqual(hallCfg.minRoomSize);
    }
  });

  it('gives every room at least one door connection onto the hall network', () => {
    const bb = plan(hallCfg, 3);
    const doored = new Set();
    for (const c of bb[LEVEL_BSP].connections) for (const id of c.rooms) doored.add(id);
    for (const z of bb[LEVEL_ZONES]) expect(doored.has(z.id)).toBe(true);
  });

  it('is almost always single-exit per room (pass-throughs are the rare exception)', () => {
    const bb = plan({ ...hallCfg, hallLoopChance: 0 }, 3);
    const exitsPerRoom = new Map();
    for (const c of bb[LEVEL_BSP].connections)
      for (const id of c.rooms) exitsPerRoom.set(id, (exitsPerRoom.get(id) ?? 0) + 1);
    const passThroughs = [...exitsPerRoom.values()].filter((n) => n > 1).length;
    expect(passThroughs).toBeLessThan(bb[LEVEL_ZONES].length / 2);
  });

  it('opens hall-to-hall junctions the full corridor width', () => {
    const wide = plan({ ...hallCfg, hallWidth: 2 }, 5)[LEVEL_BSP];
    const hallJunctions = wide.connections.filter((c) => !c.door);
    expect(hallJunctions.length).toBeGreaterThan(0);
    for (const c of hallJunctions) expect(c.tiles.length).toBe(2);
  });

  it('hallLoopChance opens extra hall junctions beyond the spanning tree', () => {
    const tree = plan({ ...hallCfg, hallLoopChance: 0 }, 6)[LEVEL_BSP];
    const looped = plan({ ...hallCfg, hallLoopChance: 1 }, 6)[LEVEL_BSP];
    const hallJunctions = (bsp) => bsp.connections.filter((c) => !c.door).length;
    expect(hallJunctions(looped)).toBeGreaterThan(hallJunctions(tree));
  });

  it('skipLeafHalls yields fewer halls and produces two-room suites', () => {
    const withHalls = plan({ ...hallCfg, skipLeafHalls: false }, 9)[LEVEL_BSP];
    const withSuites = plan({ ...hallCfg, skipLeafHalls: true }, 9)[LEVEL_BSP];
    expect(withSuites.halls.length).toBeLessThan(withHalls.halls.length);
    // a suite is an interior door between two rooms (a room-pair door)
    const suiteDoors = withSuites.connections.filter((c) => c.door && c.rooms.length === 2);
    expect(suiteDoors.length).toBeGreaterThan(0);
  });
});
