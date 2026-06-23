import { describe, it, expect } from 'vitest';
import { run as runRandomStatic } from './stage-random-static.js';
import { createLevel } from '../../level.js';
import { createRng } from '../../../engine/rng.js';
import * as spiral from '../../../../data/maps/maze-spiral.js';
import * as zigzag from '../../../../data/maps/maze-zigzag.js';
import * as pillars from '../../../../data/maps/maze-pillars.js';

// Inject the map modules so the stage doesn't go through the URL-based dynamic import (which vite
// rewrites to a dev-server URL in the test env). Real runtime uses the default importer.
const MODULES = { 'maze-spiral': spiral, 'maze-zigzag': zigzag, 'maze-pillars': pillars };
const CFG = {
  layouts: ['maze-spiral', 'maze-zigzag', 'maze-pillars'],
  importLayout: async (name) => MODULES[name],
};

async function load(seed) {
  const level = createLevel();
  await runRandomStatic(level, CFG, level.blackboard, createRng(seed));
  return level;
}

describe('randomStatic stage', () => {
  it('picks the same layout and tiles for the same seed', async () => {
    const a = await load(7);
    const b = await load(7);
    expect(a.blackboard['static:layout']).toBe(b.blackboard['static:layout']);
    expect(a.tiles).toEqual(b.tiles);
  });

  it('selects across the layout set over many seeds', async () => {
    const picked = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      picked.add((await load(seed)).blackboard['static:layout']);
    }
    for (const layout of picked) expect(CFG.layouts).toContain(layout);
    expect(picked.size).toBeGreaterThan(1);
  });

  it('loads the chosen layout tiles and stashes its entities on the blackboard', async () => {
    const level = await load(2);
    expect(level.width).toBe(15);
    expect(level.height).toBe(15);
    const entities = level.blackboard['static:entities'];
    expect(entities.some((e) => e.type === 'stairsUp')).toBe(true);
  });

  it('throws when no layouts are configured', async () => {
    const level = createLevel();
    await expect(
      runRandomStatic(level, { layouts: [] }, level.blackboard, createRng(1)),
    ).rejects.toThrow();
  });
});
