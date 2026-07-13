import { describe, it, expect } from 'vitest';
import { parseLayout } from './static-layout.js';
import { createLevel } from '../map/level.js';

const legend = { '.': 'floor', '#': 'wall' };

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
