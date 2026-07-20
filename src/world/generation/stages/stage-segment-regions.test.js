import { describe, it, expect } from 'vitest';
import { run as runSegment, distanceTransform } from './stage-segment-regions.js';
import { createLevel } from '../../map/level.js';

// A walled grid with hand-placed floor rectangles; bounds cover the whole grid.
function field(w, h, blobs) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  for (const [x0, y0, x1, y1] of blobs)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
  level.blackboard['level:bounds'] = { x: 0, y: 0, w, h };
  return level;
}

const segment = (level, config = {}) => {
  runSegment(level, config, level.blackboard);
  return level.blackboard;
};
const zonesOfKind = (bb, kind) => (bb['level:zones'] ?? []).filter((z) => z.kind === kind);

describe('distanceTransform', () => {
  it('is Chebyshev distance to the nearest wall', () => {
    const level = field(7, 7, [[1, 1, 5, 5]]); // a 5×5 room
    const D = distanceTransform(level, level.blackboard['level:bounds']);
    expect(D[0][0]).toBe(0); // wall
    expect(D[1][1]).toBe(1); // corner floor, one step from the wall
    expect(D[2][2]).toBe(2);
    expect(D[3][3]).toBe(3); // deepest interior of a 5×5 room
  });
});

describe('segmentRegions stage', () => {
  it('makes one uniform blob a single inferred chamber covering all its floor', () => {
    const level = field(9, 9, [[1, 1, 7, 7]]);
    const bb = segment(level);
    const chambers = zonesOfKind(bb, 'chamber');
    expect(chambers).toHaveLength(1);
    expect(chambers[0].origin).toBe('inferred');
    const room = bb['level:rooms'][`${chambers[0].id},0`];
    expect(room.tiles).toHaveLength(7 * 7); // every floor tile
    expect(room.core).toEqual([4, 4]); // deepest tile
  });

  it('partitions every floor tile into exactly one region', () => {
    const level = field(13, 7, [
      [1, 1, 4, 5],
      [8, 1, 11, 5],
      [5, 3, 7, 3],
    ]);
    const bb = segment(level, { prominence: 0 });
    let floor = 0;
    for (let y = 0; y < level.height; y++)
      for (let x = 0; x < level.width; x++) if (level.getTile(x, y) === 'floor') floor++;
    const claimed = new Set();
    for (const room of Object.values(bb['level:rooms']))
      for (const [x, y] of room.tiles) claimed.add(`${x},${y}`);
    expect(claimed.size).toBe(floor); // covers all, no double-count
  });

  it('splits two chambers joined by a neck at low prominence, with an adjacency and a chokepoint', () => {
    const level = field(13, 7, [
      [1, 1, 4, 5],
      [8, 1, 11, 5],
      [5, 3, 7, 3], // 1-wide neck
    ]);
    const bb = segment(level, { prominence: 0 });
    expect(zonesOfKind(bb, 'chamber')).toHaveLength(2);
    expect(bb['level:adjacency']).toHaveLength(1);
    expect(bb['level:chokepoints']).toHaveLength(1);
    const choke = bb['level:chokepoints'][0];
    expect(choke.y).toBe(3); // on the neck row
    expect(choke.width).toBe(1); // a 1-wide neck
  });

  it('merges the same two chambers into one at high prominence', () => {
    const level = field(13, 7, [
      [1, 1, 4, 5],
      [8, 1, 11, 5],
      [5, 3, 7, 3],
    ]);
    const bb = segment(level, { prominence: 5 });
    expect(bb['level:zones']).toHaveLength(1);
    expect(bb['level:adjacency']).toHaveLength(0);
  });

  it('tags a corridor-only level as passage, not chamber', () => {
    const level = field(9, 5, [[1, 2, 7, 2]]); // a 1-wide corridor
    const bb = segment(level);
    expect(zonesOfKind(bb, 'chamber')).toHaveLength(0);
    expect(zonesOfKind(bb, 'passage').length).toBeGreaterThan(0);
  });

  it('emits dug bridge tiles as a passage region, excluded from the chambers', () => {
    // Two blobs joined by a 1-wide dug bridge at y=4, x=6..9 (as caBridge would record).
    const level = field(16, 9, [
      [2, 2, 5, 6],
      [10, 2, 13, 6],
    ]);
    const dug = [];
    for (let x = 6; x <= 9; x++) {
      level.tiles[4][x] = 'floor';
      dug.push([x, 4]);
    }
    level.blackboard['level:passageTiles'] = dug;
    const bb = segment(level, { prominence: 0 });

    expect(zonesOfKind(bb, 'chamber')).toHaveLength(2);
    const passages = zonesOfKind(bb, 'passage');
    expect(passages).toHaveLength(1);
    const passageTiles = new Set(
      bb['level:rooms'][`${passages[0].id},0`].tiles.map(([x, y]) => `${x},${y}`),
    );
    expect(passageTiles.has('7,4')).toBe(true);
    // No chamber claims a bridge tile.
    for (const c of zonesOfKind(bb, 'chamber'))
      for (const [x, y] of bb['level:rooms'][`${c.id},0`].tiles)
        expect(dug.some(([dx, dy]) => dx === x && dy === y)).toBe(false);
  });

  it('is deterministic and consumes no rng', () => {
    const build = () => {
      const level = field(13, 7, [
        [1, 1, 4, 5],
        [8, 1, 11, 5],
        [5, 3, 7, 3],
      ]);
      // No rng argument passed — the stage must not touch one.
      runSegment(level, { prominence: 0 }, level.blackboard);
      return level.blackboard;
    };
    const a = build();
    const b = build();
    expect(a['level:zones']).toEqual(b['level:zones']);
    expect(a['level:chokepoints']).toEqual(b['level:chokepoints']);
  });
});
