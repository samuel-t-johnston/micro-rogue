import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createRng } from '../../engine/core/rng.js';
import { LEVEL_ZONES } from './blackboard-keys.js';

// End-to-end coverage for the terrain palette: carve stages lay down whatever tile ids the sticky
// palette names, and the category-based readers (segmentRegions, caBridge, …) keep working regardless.
describe('terrain palette through the pipeline', () => {
  const idsIn = (level) => new Set(level.tiles.flat());

  it('carves the palette tiles a `palette` stage sets, and still segments the result', async () => {
    const level = await runPipeline(
      {
        stages: [
          { type: 'palette', floor: 'cave-floor', wall: 'cave-wall' },
          { type: 'caSeed', width: 40, height: 30 },
          { type: 'caSmooth' },
          { type: 'caBridge' },
          { type: 'segmentRegions' },
        ],
      },
      createRng(3),
      createEntityRegistry(),
    );
    const ids = idsIn(level);
    expect(ids.has('cave-floor')).toBe(true);
    expect(ids.has('cave-wall')).toBe(true);
    // The palette replaces stone entirely — no stray default tiles leak through.
    expect(ids.has('floor')).toBe(false);
    expect(ids.has('wall')).toBe(false);
    // Category-based readers still found chambers in the cave-tiled level.
    expect((level.blackboard[LEVEL_ZONES] ?? []).length).toBeGreaterThan(0);
  });

  it('defaults to stone when no palette stage runs', async () => {
    const level = await runPipeline(
      {
        stages: [
          { type: 'caSeed', width: 40, height: 30 },
          { type: 'caSmooth' },
          { type: 'caBridge' },
        ],
      },
      createRng(3),
      createEntityRegistry(),
    );
    const ids = idsIn(level);
    expect(ids.has('floor')).toBe(true);
    expect(ids.has('wall')).toBe(true);
    expect(ids.has('cave-floor')).toBe(false);
  });

  it('is sticky, so one level can mix palettes across sections', async () => {
    const level = await runPipeline(
      {
        stages: [
          { type: 'box', width: 40, height: 30 }, // stone canvas
          { type: 'palette', floor: 'cave-floor', wall: 'cave-wall' },
          { type: 'caSeed', bounds: { x: 20, y: 0, w: 20, h: 30 } }, // cave in the east half only
          { type: 'caSmooth' },
          { type: 'caBridge' },
        ],
      },
      createRng(3),
      createEntityRegistry(),
    );
    const ids = idsIn(level);
    expect(ids.has('wall')).toBe(true); // stone box, west half untouched by the cave
    expect(ids.has('cave-wall')).toBe(true);
    expect(ids.has('cave-floor')).toBe(true);
  });
});
