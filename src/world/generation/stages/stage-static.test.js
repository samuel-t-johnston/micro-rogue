import { describe, it, expect } from 'vitest';
import { run as runStatic } from './stage-static.js';
import { createLevel } from '../../map/level.js';
import * as floor1a from '../../../../data/maps/floor-1-a.js';

// Inject the layout module so the stage skips the URL-based dynamic import (which vite rewrites in the
// test env). Real runtime uses the default importer. Mirrors stage-random-static.test.js.
const CFG = { layout: 'floor-1-a', importLayout: async () => floor1a };

async function load() {
  const level = createLevel();
  await runStatic(level, CFG, level.blackboard);
  return level;
}

describe('static stage', () => {
  it('loads the layout tiles into the level as a height×width grid', async () => {
    const level = await load();
    expect(level.width).toBeGreaterThan(0);
    expect(level.height).toBeGreaterThan(0);
    expect(level.tiles).toHaveLength(level.height);
    expect(level.tiles[0]).toHaveLength(level.width);
    // Every tile resolves through the layout legend to a real tile id (no unresolved cells).
    for (const row of level.tiles) for (const t of row) expect(t).toBeTruthy();
  });

  it('stashes the authored entities on the blackboard for place-static-entities', async () => {
    const level = await load();
    expect(level.blackboard['static:entities']).toEqual(floor1a.entities);
  });
});
