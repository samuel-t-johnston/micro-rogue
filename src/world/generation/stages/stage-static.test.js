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

// An embeddable block with an authored room, used for the composition tests below.
const BLOCK = {
  legend: { '.': 'floor', '#': 'wall' },
  tiles: '#####\n#...#\n#...#\n#####',
  entities: [{ type: 'orc', x: 2, y: 1 }],
  regions: {
    legend: { A: { label: 'treasure' } },
    paint: '.....\n.AAA.\n.AAA.\n.....',
  },
};

function boxedLevel(width, height) {
  const level = createLevel();
  level.width = width;
  level.height = height;
  level.tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => 'wall'));
  return level;
}

describe('static stage embedded in a boxed level', () => {
  it('stamps at bounds, offsets entities, and publishes a labelled sectioned zone', async () => {
    const level = boxedLevel(12, 8);
    await runStatic(
      level,
      {
        layout: 'blk',
        importLayout: async () => BLOCK,
        bounds: { x: 6, y: 2, w: 5, h: 4 },
        section: 'vault',
      },
      level.blackboard,
    );

    expect(level.width).toBe(12); // not resized by the embedded block
    expect(level.tiles[3][7]).toBe('floor'); // block interior (1,1) at offset (6,2)
    expect(level.blackboard['static:entities']).toEqual([{ type: 'orc', x: 8, y: 3 }]);

    const zones = level.blackboard['level:zones'];
    expect(zones).toHaveLength(1);
    expect(zones[0].section).toBe('vault');
    expect(zones[0].labels).toContain('treasure');
    expect(level.blackboard['level:rooms']['0,0'].tiles).toContainEqual([7, 3]);
  });

  it('accumulates entities and offsets zone ids across multiple static sections', async () => {
    const level = boxedLevel(12, 8);
    const cfg = (bounds) => ({ layout: 'blk', importLayout: async () => BLOCK, bounds });
    await runStatic(level, cfg({ x: 0, y: 0, w: 5, h: 4 }), level.blackboard);
    await runStatic(level, cfg({ x: 6, y: 0, w: 5, h: 4 }), level.blackboard);

    expect(level.blackboard['static:entities']).toHaveLength(2);
    expect(level.blackboard['level:zones'].map((z) => z.id)).toEqual([0, 1]);
  });

  it('publishes no zones for a layout without regions (unchanged legacy behavior)', async () => {
    const level = createLevel();
    await runStatic(level, CFG, level.blackboard);
    expect(level.blackboard['level:zones']).toBeUndefined();
  });

  it('publishes connectors (offset) and a protected footprint when embedded', async () => {
    const withConnector = {
      legend: { '.': 'floor', '#': 'wall' },
      tiles: '#####\n#....\n#####', // east wall opened at (4,1)
      regions: { legend: { '>': { connector: true } }, paint: '.....\n....>\n.....' },
    };
    const level = boxedLevel(12, 10);
    const bounds = { x: 2, y: 3, w: 5, h: 3 };
    await runStatic(
      level,
      { layout: 'blk', importLayout: async () => withConnector, bounds },
      level.blackboard,
    );
    expect(level.blackboard['level:connectors']).toEqual([[6, 4]]);
    expect(level.blackboard['level:protected']).toEqual([bounds]);
  });
});
