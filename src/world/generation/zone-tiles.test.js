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
});
