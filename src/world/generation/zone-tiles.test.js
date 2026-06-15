import { describe, it, expect } from 'vitest';
import { zoneFloorTiles, centermostFloor } from './zone-tiles.js';

const cs = 3;
const zone = { cells: [[0, 0]], rect: { x: 0, y: 0, w: 3, h: 3 } };
const withFloor = { tiles: [['wall', 'wall', 'wall'], ['wall', 'floor', 'wall'], ['wall', 'wall', 'wall']] };
const noFloor = { tiles: [['wall', 'wall', 'wall'], ['wall', 'wall', 'wall'], ['wall', 'wall', 'wall']] };

describe('zone-tiles', () => {
  it('lists the floor tiles within a zone', () => {
    expect(zoneFloorTiles(withFloor, zone, cs)).toEqual([[1, 1]]);
  });

  it('finds the floor tile nearest the zone centre', () => {
    expect(centermostFloor(withFloor, zone, cs)).toEqual([1, 1]);
  });

  it('returns null when the zone has no floor', () => {
    expect(centermostFloor(noFloor, zone, cs)).toBeNull();
  });
});
