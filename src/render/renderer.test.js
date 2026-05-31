import { describe, it, expect } from 'vitest';
import { createRenderer } from './renderer.js';
import { gameConfig } from '../engine/game-config.js';

const { tileSize } = gameConfig;

function makeRenderer(viewportW, viewportH) {
  return createRenderer({ getViewport: () => ({ width: viewportW, height: viewportH }) });
}

describe('worldToScreen', () => {
  it('places tile (0,0) at screen center when camera is at origin', () => {
    const r = makeRenderer(320, 240);
    expect(r.worldToScreen(0, 0)).toEqual({ x: 160, y: 120 });
  });

  it('offsets tiles by tileSize per tile unit', () => {
    const r = makeRenderer(320, 240);
    expect(r.worldToScreen(2, 3)).toEqual({
      x: 160 + 2 * tileSize,
      y: 120 + 3 * tileSize,
    });
  });

  it('places the camera tile at screen center after setCamera', () => {
    const r = makeRenderer(320, 240);
    r.setCamera(4, 3);
    expect(r.worldToScreen(4, 3)).toEqual({ x: 160, y: 120 });
  });

  it('tiles left of camera appear left of center', () => {
    const r = makeRenderer(320, 240);
    r.setCamera(4, 3);
    const { x } = r.worldToScreen(2, 3);
    expect(x).toBe(160 - 2 * tileSize);
  });
});

describe('screenToWorld', () => {
  it('maps screen center to camera position', () => {
    const r = makeRenderer(320, 240);
    r.setCamera(5, 4);
    const world = r.screenToWorld(160, 120);
    expect(world.x).toBeCloseTo(5);
    expect(world.y).toBeCloseTo(4);
  });

  it('is the inverse of worldToScreen for integer tile coordinates', () => {
    const r = makeRenderer(640, 480);
    r.setCamera(6, 5);
    for (const [tx, ty] of [[0, 0], [3, 2], [11, 9], [6, 5]]) {
      const screen = r.worldToScreen(tx, ty);
      const world = r.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(tx);
      expect(world.y).toBeCloseTo(ty);
    }
  });
});
