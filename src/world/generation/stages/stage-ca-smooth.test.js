import { describe, it, expect } from 'vitest';
import { run as runCaSmooth } from './stage-ca-smooth.js';
import { createLevel } from '../../map/level.js';

// Build a level from an ASCII map ('#' wall, '.' floor); bounds cover the whole grid.
function levelFrom(rows) {
  const level = createLevel();
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map((r) => [...r].map((c) => (c === '#' ? 'wall' : 'floor')));
  level.blackboard['level:bounds'] = { x: 0, y: 0, w: level.width, h: level.height };
  return level;
}

const at = (level, x, y) => level.getTile(x, y);

describe('caSmooth stage', () => {
  it('turns a tile to wall when ≥ threshold neighbours are wall', () => {
    // Centre (2,2) is floor with exactly 5 wall neighbours (row above + the two mid sides) → wall.
    const level = levelFrom(['#####', '#####', '##.##', '#...#', '#####']);
    runCaSmooth(level, { iterations: 1 }, level.blackboard);
    expect(at(level, 2, 2)).toBe('wall');
  });

  it('leaves a tile floor when fewer than threshold neighbours are wall', () => {
    // Centre (2,2) floor with only 2 wall neighbours (the vertical pair) → stays floor.
    const level = levelFrom(['#####', '#.#.#', '#...#', '#.#.#', '#####']);
    runCaSmooth(level, { iterations: 1 }, level.blackboard);
    expect(at(level, 2, 2)).toBe('floor');
  });

  it('holds the border to wall and consumes no rng', () => {
    const level = levelFrom(['######', '#....#', '#....#', '#....#', '######']);
    // No rng argument passed at all — the stage must not touch one.
    runCaSmooth(level, { iterations: 3 }, level.blackboard);
    for (let x = 0; x < level.width; x++) {
      expect(at(level, x, 0)).toBe('wall');
      expect(at(level, x, level.height - 1)).toBe('wall');
    }
  });

  it('fills an isolated floor speckle surrounded by walls', () => {
    const level = levelFrom(['#####', '#####', '##.##', '#####', '#####']);
    runCaSmooth(level, { iterations: 1 }, level.blackboard);
    expect(at(level, 2, 2)).toBe('wall'); // 8 wall neighbours → wall
  });

  it('is deterministic', () => {
    const a = levelFrom(['######', '#.##.#', '#....#', '#.##.#', '#..#.#', '######']);
    const b = levelFrom(['######', '#.##.#', '#....#', '#.##.#', '#..#.#', '######']);
    runCaSmooth(a, { iterations: 2 }, a.blackboard);
    runCaSmooth(b, { iterations: 2 }, b.blackboard);
    expect(a.tiles).toEqual(b.tiles);
  });
});
