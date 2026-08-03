import { describe, it, expect } from 'vitest';
import { run as runLineWalls } from './stage-line-walls.js';
import { createLevel } from '../../map/level.js';

// Builds a level from a rows array: '#' -> wall, '%' -> cave-wall, '.' -> floor. Rows must be equal
// length. Runs the stage and returns the level so tests can read tiles[y][x].
function lineWalls(rows) {
  const glyphToId = { '#': 'wall', '%': 'cave-wall', '.': 'floor' };
  const level = createLevel();
  level.tiles = rows.map((r) => [...r].map((c) => glyphToId[c]));
  level.height = level.tiles.length;
  level.width = level.tiles[0].length;
  runLineWalls(level);
  return level;
}

describe('lineWalls stage', () => {
  it('rewrites a vertical run to the N-S variant', () => {
    const level = lineWalls(['.#.', '.#.', '.#.']);
    expect(level.tiles[1][1]).toBe('wall-ns');
  });

  it('rewrites a plus junction to the full N-E-S-W variant', () => {
    const level = lineWalls(['.#.', '###', '.#.']);
    expect(level.tiles[1][1]).toBe('wall-nesw');
  });

  it('rewrites a T-junction to the three-way variant', () => {
    // Center has walls N, S, and E (to its right), floor to the W.
    const level = lineWalls(['.#.', '.##', '.#.']);
    expect(level.tiles[1][1]).toBe('wall-nes');
  });

  it('leaves an isolated wall as its base id', () => {
    const level = lineWalls(['...', '.#.', '...']);
    expect(level.tiles[1][1]).toBe('wall');
  });

  it('treats off-grid as empty so a border corner draws a clean box corner', () => {
    // Each cell of a 2x2 block has two real wall neighbours; off-grid neighbours count as empty, so a
    // corner connects only inward — top-left links E and S.
    const level = lineWalls(['##', '##']);
    expect(level.tiles[0][0]).toBe('wall-es');
    expect(level.tiles[0][1]).toBe('wall-sw');
    expect(level.tiles[1][0]).toBe('wall-ne');
    expect(level.tiles[1][1]).toBe('wall-nw');
  });

  it('connects across wall families (any wall category is a neighbour)', () => {
    const level = lineWalls(['.%.', '.#.', '.%.']);
    expect(level.tiles[1][1]).toBe('wall-ns');
  });

  it('rewrites cave walls into their own family', () => {
    const level = lineWalls(['.%.', '.%.', '.%.']);
    expect(level.tiles[1][1]).toBe('cave-wall-ns');
  });

  it('leaves floor tiles untouched', () => {
    const level = lineWalls(['.#.', '###', '.#.']);
    expect(level.tiles[0][0]).toBe('floor');
  });
});
