import { describe, it, expect } from 'vitest';
import { createZoom, defaultZoomIndex, ZOOM_LEVELS } from './zoom.js';

describe('zoom ladder', () => {
  it('reports the on-screen tile size for the current level', () => {
    const z = createZoom({ index: 0 });
    expect(z.tileSize).toBe(ZOOM_LEVELS[0]);
  });

  it('zoomIn steps to a larger (closer) tile size and clamps at the closest level', () => {
    const z = createZoom({ index: 0 });
    z.zoomIn();
    expect(z.tileSize).toBe(ZOOM_LEVELS[1]);
    for (let i = 0; i < ZOOM_LEVELS.length; i++) z.zoomIn();
    expect(z.index).toBe(ZOOM_LEVELS.length - 1);
    expect(z.canZoomIn).toBe(false);
  });

  it('zoomOut steps to a smaller (wider) tile size and clamps at the widest level', () => {
    const z = createZoom({ index: ZOOM_LEVELS.length - 1 });
    z.zoomOut();
    expect(z.tileSize).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 2]);
    for (let i = 0; i < ZOOM_LEVELS.length; i++) z.zoomOut();
    expect(z.index).toBe(0);
    expect(z.canZoomOut).toBe(false);
  });

  it('clamps an out-of-range starting index into the ladder', () => {
    expect(createZoom({ index: 99 }).index).toBe(ZOOM_LEVELS.length - 1);
    expect(createZoom({ index: -5 }).index).toBe(0);
  });
});

describe('defaultZoomIndex', () => {
  it('starts coarse pointers (touch) closer, at 48px tiles', () => {
    expect(ZOOM_LEVELS[defaultZoomIndex(true)]).toBe(48);
  });

  it('starts precise pointers (mouse) wider, at 32px tiles', () => {
    expect(ZOOM_LEVELS[defaultZoomIndex(false)]).toBe(32);
  });
});
