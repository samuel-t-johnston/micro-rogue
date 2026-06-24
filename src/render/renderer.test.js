import { describe, it, expect } from 'vitest';
import { createRenderer } from './renderer.js';
import { createZoom, ZOOM_LEVELS } from './zoom.js';
import { createLevel } from '../world/map/level.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';
import { RenderLayers } from './render-layers.js';

function makeRenderer(viewportW, viewportH) {
  return createRenderer({ getViewport: () => ({ width: viewportW, height: viewportH }) });
}

describe('worldToScreen', () => {
  it('places tile (0,0) at screen center when camera is at origin', () => {
    const r = makeRenderer(320, 240);
    expect(r.worldToScreen(0, 0)).toEqual({ x: 160, y: 120 });
  });

  it('offsets tiles by the active tile size per tile unit', () => {
    const r = makeRenderer(320, 240);
    const tileSize = r.tileSize;
    expect(r.worldToScreen(2, 3)).toEqual({
      x: 160 + 2 * tileSize,
      y: 120 + 3 * tileSize,
    });
  });

  it('scales the per-tile offset with the zoom level', () => {
    const zoom = createZoom({ index: 0 }); // widest level
    const r = createRenderer({ getViewport: () => ({ width: 320, height: 240 }), zoom });
    expect(r.worldToScreen(2, 0).x).toBe(160 + 2 * ZOOM_LEVELS[0]);
    zoom.zoomIn();
    expect(r.worldToScreen(2, 0).x).toBe(160 + 2 * ZOOM_LEVELS[1]);
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
    expect(x).toBe(160 - 2 * r.tileSize);
  });
});

describe('drawEntities — layer ordering', () => {
  // Recording ctx: tracks each fillRect call so we can verify draw order.
  // The renderer falls back to fillRect when the sprite sheet isn't loaded,
  // which is exactly our case (we don't call renderer.load()).
  function makeRecordingCtx() {
    const fills = [];
    return {
      _fills: fills,
      set fillStyle(v) {
        this._lastFill = v;
      },
      get fillStyle() {
        return this._lastFill;
      },
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
      set globalAlpha(_) {},
      fillRect(x, y, w, h) {
        fills.push({ x, y, w, h, color: this._lastFill });
      },
      fillText() {},
    };
  }

  function entityAt(registry, name, x, y, layer) {
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(
      e,
      'renderable',
      components.renderable(null, name, undefined, undefined, layer),
    );
    return e;
  }

  function makeLevelWith(entities) {
    const level = createLevel();
    level.width = 10;
    level.height = 10;
    level.tiles = Array.from({ length: 10 }, () => Array(10).fill('floor'));
    for (const e of entities) level.placeEntity(e);
    return level;
  }

  it('draws lower-layer entities before higher-layer entities at the same tile', () => {
    const r = createRenderer({ getViewport: () => ({ width: 320, height: 240 }) });
    r.setCamera(5, 5);
    const registry = createEntityRegistry();
    // Insert creature FIRST (DEFAULT layer), then item (ITEM layer) — the dropped-item bug condition.
    const creature = entityAt(registry, 'creature', 5, 5, RenderLayers.DEFAULT);
    const item = entityAt(registry, 'item', 5, 5, RenderLayers.ITEM);
    const level = makeLevelWith([creature, item]);

    const ctx = makeRecordingCtx();
    r.drawEntities(ctx, level, null);

    expect(ctx._fills.map((f) => f.color)).toEqual(['item', 'creature']);
  });

  it('defaults to DEFAULT layer when renderable.layer is undefined', () => {
    const r = createRenderer({ getViewport: () => ({ width: 320, height: 240 }) });
    r.setCamera(5, 5);
    const registry = createEntityRegistry();
    // No layer specified → component factory falls back to DEFAULT. Item at ITEM should still draw first.
    const noLayer = registry.createEntity();
    registry.addComponent(noLayer, 'position', components.position(5, 5));
    registry.addComponent(noLayer, 'renderable', components.renderable(null, 'no-layer'));
    const item = entityAt(registry, 'item', 5, 5, RenderLayers.ITEM);
    const level = makeLevelWith([noLayer, item]);

    const ctx = makeRecordingCtx();
    r.drawEntities(ctx, level, null);

    expect(ctx._fills.map((f) => f.color)).toEqual(['item', 'no-layer']);
  });

  it('preserves insertion order for entities at the same layer (stable sort)', () => {
    const r = createRenderer({ getViewport: () => ({ width: 320, height: 240 }) });
    r.setCamera(5, 5);
    const registry = createEntityRegistry();
    const a = entityAt(registry, 'a', 5, 5, RenderLayers.DEFAULT);
    const b = entityAt(registry, 'b', 5, 5, RenderLayers.DEFAULT);
    const level = makeLevelWith([a, b]);

    const ctx = makeRecordingCtx();
    r.drawEntities(ctx, level, null);

    expect(ctx._fills.map((f) => f.color)).toEqual(['a', 'b']);
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
    for (const [tx, ty] of [
      [0, 0],
      [3, 2],
      [11, 9],
      [6, 5],
    ]) {
      const screen = r.worldToScreen(tx, ty);
      const world = r.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(tx);
      expect(world.y).toBeCloseTo(ty);
    }
  });
});
