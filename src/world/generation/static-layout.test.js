import { describe, it, expect } from 'vitest';
import { parseLayout, parseRegions } from './static-layout.js';
import { createLevel } from '../map/level.js';

const legend = { '.': 'floor', '#': 'wall' };

/** A pre-sized all-wall level, as the `box` stage would leave it for an embedded section. */
function boxedLevel(width, height) {
  const level = createLevel();
  level.width = width;
  level.height = height;
  level.tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => 'wall'));
  return level;
}

describe('parseLayout', () => {
  it('writes the tile grid into the level and returns the authored entities', () => {
    const level = createLevel();
    const entities = parseLayout(
      { legend, tiles: '###\n#.#\n###', entities: [{ type: 'stairsUp', x: 1, y: 1 }] },
      'test',
      level,
    );
    expect(level.width).toBe(3);
    expect(level.height).toBe(3);
    expect(level.tiles[1][1]).toBe('floor');
    expect(entities).toEqual([{ type: 'stairsUp', x: 1, y: 1 }]);
  });

  it('defaults to an empty entity list when the map declares none', () => {
    expect(parseLayout({ legend, tiles: '##\n##' }, 'test', createLevel())).toEqual([]);
  });

  it('throws on inconsistent row lengths', () => {
    expect(() => parseLayout({ legend, tiles: '###\n#.' }, 'bad', createLevel())).toThrow(
      /inconsistent row lengths/,
    );
  });

  it('throws on a symbol missing from the legend', () => {
    expect(() => parseLayout({ legend, tiles: '#?#' }, 'bad', createLevel())).toThrow(
      /Unknown symbol "\?"/,
    );
  });

  // MAP-8 (B6): an empty or all-whitespace layout must throw, not silently produce a 0-width level.
  it('throws on an empty layout', () => {
    expect(() => parseLayout({ legend, tiles: '' }, 'empty', createLevel())).toThrow(/is empty/);
  });

  it('throws on an all-whitespace layout', () => {
    expect(() => parseLayout({ legend, tiles: '  \n  ' }, 'blank', createLevel())).toThrow(
      /is empty/,
    );
  });
});

describe('parseLayout embedded at bounds', () => {
  const mod = { legend, tiles: '###\n#.#\n###' };

  it('stamps the layout at the bounds offset without resizing the level', () => {
    const level = boxedLevel(10, 8);
    parseLayout(mod, 'blk', level, { x: 4, y: 2, w: 3, h: 3 });
    expect(level.width).toBe(10);
    expect(level.height).toBe(8);
    expect(level.tiles[3][5]).toBe('floor'); // the layout's centre (1,1) at offset (4,2)
    expect(level.tiles[0][0]).toBe('wall'); // outside the block, untouched
    expect(level.tiles[2][4]).toBe('wall'); // the block's own top-left wall
  });

  it('offsets authored entities by the bounds origin', () => {
    const level = boxedLevel(10, 8);
    const entities = parseLayout(
      { ...mod, entities: [{ type: 'stairsUp', x: 1, y: 1, port: 'up' }] },
      'blk',
      level,
      { x: 4, y: 2, w: 3, h: 3 },
    );
    expect(entities).toEqual([{ type: 'stairsUp', x: 5, y: 3, port: 'up' }]);
  });

  it('throws when the layout is larger than its bounds', () => {
    const level = boxedLevel(10, 8);
    expect(() =>
      parseLayout({ legend, tiles: '####\n####' }, 'big', level, { x: 0, y: 0, w: 3, h: 3 }),
    ).toThrow(/does not fit/);
  });
});

describe('parseRegions', () => {
  it('returns no zones when the module declares no regions', () => {
    expect(parseRegions({ legend, tiles: '##\n##' })).toEqual({
      zones: [],
      rooms: {},
      connectors: [],
    });
  });

  it('builds an irregular tile-set zone from a paint layer, with its label', () => {
    const mod = {
      legend,
      tiles: '#####\n#...#\n#...#\n#####',
      regions: {
        legend: { A: { label: 'treasure' } },
        paint: '.....\n.AAA.\n.AAA.\n.....',
      },
    };
    const { zones, rooms } = parseRegions(mod);
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe(0);
    expect(zones[0].labels).toEqual(['room', 'treasure']);
    expect(zones[0].origin).toBe('tagged');
    expect(rooms['0,0'].tiles).toEqual(
      expect.arrayContaining([
        [1, 1],
        [3, 1],
        [3, 2],
      ]),
    );
    expect(rooms['0,0'].tiles).toHaveLength(6);
  });

  it('builds a rectangular room from a rect definition', () => {
    const mod = {
      legend,
      tiles: '#####\n#...#\n#####',
      regions: {
        legend: { B: { labels: ['stairs-up'] } },
        rects: [{ glyph: 'B', x0: 1, y0: 1, x1: 3, y1: 1 }],
      },
    };
    const { zones, rooms } = parseRegions(mod);
    expect(zones[0].labels).toEqual(['room', 'stairs-up']);
    expect(rooms['0,0']).toEqual({ x0: 1, y0: 1, x1: 3, y1: 1 });
  });

  it('offsets painted region tiles by bounds', () => {
    const mod = {
      legend,
      tiles: '###\n#.#\n###',
      regions: { legend: { A: { label: 'item' } }, paint: '...\n.A.\n...' },
    };
    const { rooms } = parseRegions(mod, { x: 10, y: 5, w: 3, h: 3 });
    expect(rooms['0,0'].tiles).toEqual([[11, 6]]);
  });

  it('assigns stable dense ids in glyph order regardless of paint position', () => {
    const mod = {
      legend,
      tiles: '#####\n#...#\n#####',
      regions: {
        legend: { B: { label: 'item' }, A: { label: 'treasure' } },
        paint: '.....\n.BA..\n.....',
      },
    };
    const { zones } = parseRegions(mod);
    expect(zones.map((z) => z.id)).toEqual([0, 1]);
    expect(zones[0].labels).toContain('treasure'); // glyph A sorts first -> id 0
    expect(zones[1].labels).toContain('item');
  });

  it('ignores paint chars not in the region legend (they are alignment filler)', () => {
    const mod = {
      legend,
      tiles: '###\n#.#\n###',
      regions: { legend: { A: { label: 'item' } }, paint: '...\n.Q.\n...' },
    };
    expect(parseRegions(mod)).toEqual({ zones: [], rooms: {}, connectors: [] });
  });

  it('throws when a rect names a glyph missing from the region legend', () => {
    const mod = {
      legend,
      tiles: '###\n#.#\n###',
      regions: {
        legend: { A: { label: 'item' } },
        rects: [{ glyph: 'Q', x0: 1, y0: 1, x1: 1, y1: 1 }],
      },
    };
    expect(() => parseRegions(mod)).toThrow(/"Q"/);
  });

  it('throws when the paint layer does not match the tile grid dimensions', () => {
    const mod = {
      legend,
      tiles: '###\n#.#\n###',
      regions: { legend: { A: { label: 'item' } }, paint: '..\n.A' },
    };
    expect(() => parseRegions(mod)).toThrow(/dimensions|match/i);
  });

  it('collects connector tiles (offset by bounds) without making them rooms', () => {
    const mod = {
      // east wall opened at (4,1) so the connector sits on floor
      legend,
      tiles: '#####\n#....\n#####',
      regions: { legend: { '>': { connector: true } }, paint: '.....\n....>\n.....' },
    };
    const { zones, rooms, connectors } = parseRegions(mod, { x: 10, y: 5, w: 5, h: 3 });
    expect(zones).toEqual([]);
    expect(rooms).toEqual({});
    expect(connectors).toEqual([[14, 6]]);
  });

  it('throws when a connector sits on a non-floor tile', () => {
    const mod = {
      legend,
      tiles: '#####\n#...#\n#####',
      regions: { legend: { '>': { connector: true } }, paint: '..>..\n.....\n.....' },
    };
    expect(() => parseRegions(mod)).toThrow(/floor|connector/i);
  });
});
