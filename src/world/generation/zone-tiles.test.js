import { describe, it, expect } from 'vitest';
import { roomTiles, centermostRoomTile } from './zone-tiles.js';

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
