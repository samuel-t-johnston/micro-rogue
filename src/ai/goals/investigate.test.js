import { describe, it, expect } from 'vitest';
import { investigate } from './investigate.js';
import { createLevel } from '../../world/level.js';

function openLevel(w = 12, h = 12) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

function ctx(memory, { level = openLevel(), x = 5, y = 5, turnCount = 1 } = {}) {
  return { memory, selfState: { position: { x, y } }, level, turnCount };
}

const lead = (pos, turn = 0) => ({ lastKnownEnemy: { pos, turn, source: 'sight' } });

describe('investigate', () => {
  it('returns null with no lead', () => {
    expect(investigate.evaluate(ctx({}))).toBeNull();
  });

  it('steps along the path toward the lead', () => {
    const result = investigate.evaluate(ctx(lead({ x: 8, y: 5 })));
    // Shortest 8-dir path of length 3 must advance x to 6 on the first step.
    expect(result.action).toMatchObject({ type: 'move', x: 6 });
    expect([4, 5, 6]).toContain(result.action.y);
  });

  it('clears the lead and stops on arrival', () => {
    const memory = lead({ x: 5, y: 5 });
    expect(investigate.evaluate(ctx(memory))).toBeNull();
    expect(memory.lastKnownEnemy).toBeUndefined();
  });

  it('forgets a stale lead', () => {
    const memory = lead({ x: 8, y: 5 }, 0);
    expect(investigate.evaluate(ctx(memory, { turnCount: 99 }))).toBeNull();
    expect(memory.lastKnownEnemy).toBeUndefined();
  });

  it('forgets an unreachable lead', () => {
    const level = openLevel();
    level.tiles[5][8] = 'wall'; // target tile is solid → no path
    const memory = lead({ x: 8, y: 5 });
    expect(investigate.evaluate(ctx(memory, { level }))).toBeNull();
    expect(memory.lastKnownEnemy).toBeUndefined();
  });
});
