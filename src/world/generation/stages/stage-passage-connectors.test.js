import { describe, it, expect } from 'vitest';
import { run as runPassageConnectors } from './stage-passage-connectors.js';
import { run as runStitch } from './stage-stitch.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createRng } from '../../../engine/core/rng.js';

// A chamber (cols 1–4) and a separate width-1 passage corridor (cols 7–10, row 3), a two-tile wall gap
// apart. The passage is its own floor component with a `passage` zone — the case stitch ignores.
function chamberAndPassage() {
  const w = 12;
  const h = 7;
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('wall'));
  const fill = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
  };
  const tilesOf = (x0, y0, x1, y1) => {
    const t = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push([x, y]);
    return t;
  };
  fill(1, 1, 4, 5); // chamber
  fill(7, 3, 10, 3); // passage corridor
  level.blackboard['level:zones'] = [
    { id: 0, cells: [[0, 0]], rect: {}, labels: ['room'], kind: 'chamber' },
    { id: 1, cells: [[1, 0]], rect: {}, labels: [], kind: 'passage' },
  ];
  level.blackboard['level:rooms'] = {
    '0,0': { tiles: tilesOf(1, 1, 4, 5) },
    '1,0': { tiles: tilesOf(7, 3, 10, 3) },
  };
  return level;
}

function connected(level) {
  const floor = (x, y) => level.getTile(x, y) === 'floor';
  let start = null;
  for (let y = 0; y < level.height && !start; y++)
    for (let x = 0; x < level.width && !start; x++) if (floor(x, y)) start = [x, y];
  const seen = new Set([`${start[0]},${start[1]}`]);
  const stack = [start];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (floor(x + dx, y + dy) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  let total = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) if (floor(x, y)) total++;
  return seen.size === total;
}

describe('passageConnectors stage', () => {
  it('publishes passage-zone frontier tiles as connectors, and no chamber tiles', () => {
    const level = chamberAndPassage();
    runPassageConnectors(level, {}, level.blackboard);
    const connectors = level.blackboard['level:connectors'];
    // The width-1 corridor is all frontier, so every passage tile is published.
    expect(connectors).toContainEqual([7, 3]);
    expect(connectors).toContainEqual([10, 3]);
    expect(connectors).toHaveLength(4);
    // No chamber tile leaks in.
    expect(connectors).not.toContainEqual([1, 1]);
  });

  it('restricts to a section when one is given', () => {
    const level = chamberAndPassage();
    level.blackboard['level:zones'][1].section = 'east';
    runPassageConnectors(level, { section: 'west' }, level.blackboard);
    expect(level.blackboard['level:connectors'] ?? []).toHaveLength(0);
    runPassageConnectors(level, { section: 'east' }, level.blackboard);
    expect(level.blackboard['level:connectors']).toHaveLength(4);
  });

  it('lets stitch join a passage-only component that it would otherwise strand', () => {
    // Control: without connectors the passage stays disconnected (stitch only sees the chamber).
    const control = chamberAndPassage();
    runStitch(control, {}, control.blackboard, createRng(1), createEntityRegistry());
    expect(connected(control)).toBe(false);

    // With passage connectors published first, stitch can reach the corridor.
    const level = chamberAndPassage();
    runPassageConnectors(level, {}, level.blackboard);
    runStitch(level, {}, level.blackboard, createRng(1), createEntityRegistry());
    expect(connected(level)).toBe(true);
  });
});
