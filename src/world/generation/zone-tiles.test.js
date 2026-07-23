import { describe, it, expect } from 'vitest';
import { roomTiles, centermostRoomTile, appendZones } from './zone-tiles.js';

// A single-cell zone whose room is a 2x2 rect at (1,1)-(2,2) within cell (0,0).
const zone = { id: 0, cells: [[0, 0]], rect: { x: 0, y: 0, w: 10, h: 10 } };
const rooms = { '0,0': { x0: 1, y0: 1, x1: 2, y1: 2 } };

describe('zone-tiles', () => {
  it('lists the floor tiles inside a zone room rect', () => {
    expect(roomTiles(zone, rooms).sort()).toEqual(
      [
        [1, 1],
        [1, 2],
        [2, 1],
        [2, 2],
      ].sort(),
    );
  });

  it("gathers tiles across a merged zone's cells", () => {
    const merged = {
      id: 1,
      cells: [
        [0, 0],
        [1, 0],
      ],
      rect: { x: 0, y: 0, w: 20, h: 10 },
    };
    const r = { '0,0': { x0: 1, y0: 1, x1: 1, y1: 1 }, '1,0': { x0: 11, y0: 1, x1: 11, y1: 1 } };
    expect(roomTiles(merged, r)).toHaveLength(2);
  });

  it('finds the room tile nearest the zone centre', () => {
    // Zone centre is (5,5); of the four tiles, (2,2) is closest.
    expect(centermostRoomTile(zone, rooms)).toEqual([2, 2]);
  });

  it('returns null when the zone has no room', () => {
    expect(centermostRoomTile(zone, {})).toBeNull();
  });

  it("lists an irregular room's explicit tiles", () => {
    const z = { id: 2, cells: [[0, 0]], rect: { x: 0, y: 0, w: 10, h: 10 } };
    const r = {
      '0,0': {
        tiles: [
          [1, 1],
          [2, 1],
          [1, 2],
        ],
      },
    };
    expect(roomTiles(z, r).sort()).toEqual(
      [
        [1, 1],
        [1, 2],
        [2, 1],
      ].sort(),
    );
  });

  it("mixes tile-set and rect rooms across a zone's cells", () => {
    const merged = {
      id: 3,
      cells: [
        [0, 0],
        [1, 0],
      ],
      rect: { x: 0, y: 0, w: 20, h: 10 },
    };
    const r = { '0,0': { tiles: [[1, 1]] }, '1,0': { x0: 11, y0: 1, x1: 11, y1: 1 } };
    expect(roomTiles(merged, r).sort()).toEqual(
      [
        [1, 1],
        [11, 1],
      ].sort(),
    );
  });

  it('prefers an explicit core over the geometric centroid', () => {
    // Centroid (5,5) is nearest to (2,1), but the core is a deep-interior anchor and wins outright —
    // this is how an irregular cavern avoids anchoring stairs/entry on a wall-adjacent tile.
    const z = { id: 4, cells: [[0, 0]], rect: { x: 0, y: 0, w: 10, h: 10 } };
    const r = {
      '0,0': {
        tiles: [
          [1, 1],
          [2, 1],
          [8, 8],
        ],
        core: [8, 8],
      },
    };
    expect(centermostRoomTile(z, r)).toEqual([8, 8]);
  });
});

describe('appendZones', () => {
  const zone = (id) => ({ id, cells: [[id, 0]], rect: {}, labels: ['room'] });

  it('writes a first section directly (base 0, unchanged ids)', () => {
    const bb = {};
    const base = appendZones(bb, {
      zones: [zone(0), zone(1)],
      rooms: { '0,0': { tiles: [[1, 1]] }, '1,0': { tiles: [[2, 2]] } },
      adjacency: [[0, 1]],
    });
    expect(base).toBe(0);
    expect(bb['level:zones'].map((z) => z.id)).toEqual([0, 1]);
    expect(bb['level:rooms']['1,0']).toEqual({ tiles: [[2, 2]] });
    expect(bb['level:adjacency']).toEqual([[0, 1]]);
  });

  it('offsets a second section past the first, remapping cells, room keys, and adjacency', () => {
    const bb = {};
    appendZones(bb, {
      zones: [zone(0), zone(1)],
      rooms: { '0,0': { tiles: [[1, 1]] }, '1,0': { tiles: [[2, 2]] } },
      adjacency: [[0, 1]],
    });
    const base = appendZones(bb, {
      zones: [{ id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' }],
      rooms: { '0,0': { tiles: [[9, 9]] } },
      chokepoints: [{ x: 9, y: 9, width: 1 }],
    });
    expect(base).toBe(2);
    expect(bb['level:zones'].map((z) => z.id)).toEqual([0, 1, 2]); // dense, no collision
    expect(bb['level:zones'][2].cells).toEqual([[2, 0]]); // cell id remapped
    expect(bb['level:rooms']['2,0']).toEqual({ tiles: [[9, 9]] }); // room key remapped
    expect(bb['level:rooms']['0,0']).toEqual({ tiles: [[1, 1]] }); // first section preserved
    expect(bb['level:adjacency']).toEqual([[0, 1]]); // first section's adjacency intact
    expect(bb['level:chokepoints']).toEqual([{ x: 9, y: 9, width: 1 }]);
  });

  it('offsets a later section’s adjacency pairs and link ids', () => {
    const bb = { 'level:zones': [{ id: 0 }, { id: 1 }] };
    appendZones(bb, {
      zones: [zone(0), zone(1)],
      rooms: {},
      adjacency: [[0, 1]],
      links: [{ id: 0, a: 0, b: 1 }],
    });
    expect(bb['level:adjacency']).toEqual([[2, 3]]);
    expect(bb['level:links']).toEqual([{ id: 0, a: 2, b: 3 }]);
  });
});
