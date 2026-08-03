import { describe, it, expect } from 'vitest';
import TERRAIN from './terrain.js';
import {
  lineWallId,
  LINE_WALL_TILES,
  LINE_WALL_FAMILIES,
  DIR_N,
  DIR_E,
  DIR_S,
  DIR_W,
} from './line-walls.js';

describe('lineWallId', () => {
  it('returns the base id unchanged for an isolated wall (mask 0)', () => {
    expect(lineWallId('wall', 0)).toBe('wall');
  });

  it('maps a vertical mask (N+S) to the -ns variant', () => {
    expect(lineWallId('wall', DIR_N | DIR_S)).toBe('wall-ns');
  });

  it('maps a full cross (N+E+S+W) to the -nesw variant', () => {
    expect(lineWallId('cave-wall', DIR_N | DIR_E | DIR_S | DIR_W)).toBe('cave-wall-nesw');
  });

  it('orders the suffix directions N-E-S-W', () => {
    expect(lineWallId('wall', DIR_N | DIR_E | DIR_S)).toBe('wall-nes');
    expect(lineWallId('wall', DIR_N | DIR_S | DIR_W)).toBe('wall-nsw');
  });

  it('passes through a base with no line-wall family', () => {
    expect(lineWallId('cave-floor', DIR_N | DIR_S)).toBe('cave-floor');
  });
});

describe('LINE_WALL_TILES', () => {
  it('defines 15 variants per family', () => {
    expect(Object.keys(LINE_WALL_TILES)).toHaveLength(15 * LINE_WALL_FAMILIES.length);
  });

  it('inherits the base def and overrides only the glyph', () => {
    const base = TERRAIN.wall;
    const variant = LINE_WALL_TILES['wall-ns'];
    expect(variant.glyph).toBe('║');
    expect(variant.category).toBe('wall');
    expect(variant.blocksMovement).toBe(base.blocksMovement);
    expect(variant.opaque).toBe(base.opaque);
    expect(variant.sprite).toBe(base.sprite);
    expect(variant.name).toBe(base.name);
    expect(variant.color).toBe(base.color);
  });

  it('gives every variant a truthy box-drawing glyph', () => {
    for (const def of Object.values(LINE_WALL_TILES)) expect(def.glyph).toBeTruthy();
  });
});
