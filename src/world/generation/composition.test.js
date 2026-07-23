import { describe, it, expect } from 'vitest';
import { run as runBox } from './stages/stage-box.js';
import { run as runBspGeometry } from './stages/stage-bsp-geometry.js';
import { run as runBspCarve } from './stages/stage-bsp-carve.js';
import { run as runCaSeed } from './stages/stage-ca-seed.js';
import { run as runCaSmooth } from './stages/stage-ca-smooth.js';
import { run as runCaBridge } from './stages/stage-ca-bridge.js';
import { run as runSegmentRegions } from './stages/stage-segment-regions.js';
import { createLevel } from '../map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createRng } from '../../engine/core/rng.js';

// A box with a BSP wing in the left half and a CA cave in the right half — two structure sections in
// one pipeline. (Connecting the two sections is a later slice; this asserts they coexist.)
function composite(seed) {
  const level = createLevel();
  const reg = createEntityRegistry();
  const bb = level.blackboard;
  const rng = createRng(seed);
  const left = { x: 0, y: 0, w: 28, h: 40 };
  const right = { x: 28, y: 0, w: 28, h: 40 };
  runBox(level, { width: 56, height: 40 }, bb, rng);
  runBspGeometry(level, { bounds: left, minRoomSize: 6, includeHalls: true }, bb, rng);
  runBspCarve(level, {}, bb, rng, reg);
  runCaSeed(level, { bounds: right }, bb, rng);
  runCaSmooth(level, {}, bb);
  runCaBridge(level, {}, bb, rng);
  runSegmentRegions(level, {}, bb);
  return { level, bb };
}

const floorInRange = (level, x0, x1) => {
  for (let y = 0; y < level.height; y++)
    for (let x = x0; x <= x1; x++) if (level.getTile(x, y) === 'floor') return true;
  return false;
};

describe('composition: BSP + CA sections in one pipeline', () => {
  it('carves both sections into the shared box', () => {
    const { level } = composite(1);
    expect(level.width).toBe(56);
    expect(floorInRange(level, 0, 27)).toBe(true); // BSP wing
    expect(floorInRange(level, 28, 55)).toBe(true); // CA cave
  });

  it('keeps both sections’ zones with distinct ids (no collision)', () => {
    const { bb } = composite(1);
    const zones = bb['level:zones'];
    const bsp = zones.filter((z) => z.origin == null); // BSP tags no origin
    const ca = zones.filter((z) => z.origin === 'inferred'); // CA infers
    expect(bsp.length).toBeGreaterThan(0);
    expect(ca.length).toBeGreaterThan(0);
    const ids = zones.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(Math.min(...ids)).toBe(0);
    expect(Math.max(...ids)).toBe(ids.length - 1); // dense
  });

  it('every zone resolves to its own room tiles', () => {
    const { bb } = composite(1);
    for (const z of bb['level:zones']) expect(bb['level:rooms'][`${z.id},0`]).toBeTruthy();
  });

  it('is deterministic for a given seed', () => {
    expect(composite(3).level.tiles).toEqual(composite(3).level.tiles);
  });
});
