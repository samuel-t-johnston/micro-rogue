import { describe, it, expect } from 'vitest';
import { run } from './stage-palette.js';
import { DEFAULT_PALETTE, paletteOf } from '../palette.js';
import { LEVEL_PALETTE } from '../blackboard-keys.js';

describe('palette stage', () => {
  it('defaults to stone floor/wall when no palette stage has run', () => {
    expect(paletteOf({})).toEqual({ floor: 'floor', wall: 'wall' });
  });

  it('sets the blackboard palette from the default', () => {
    const bb = {};
    run({}, { floor: 'cave-floor', wall: 'cave-wall' }, bb);
    expect(paletteOf(bb)).toEqual({ floor: 'cave-floor', wall: 'cave-wall' });
  });

  it('merges — a stage that sets only one slot leaves the other sticky', () => {
    const bb = {};
    run({}, { floor: 'cave-floor', wall: 'cave-wall' }, bb);
    run({}, { floor: 'floor' }, bb); // flip the floor back, keep the cave wall
    expect(paletteOf(bb)).toEqual({ floor: 'floor', wall: 'cave-wall' });
  });

  it('rejects a tile whose category does not match its slot', () => {
    expect(() => run({}, { floor: 'wall' }, {})).toThrow(/floor/);
    expect(() => run({}, { wall: 'cave-floor' }, {})).toThrow(/wall/);
    expect(() => run({}, { floor: 'nope' }, {})).toThrow();
  });

  it('never mutates the shared DEFAULT_PALETTE constant', () => {
    const bb = {};
    run({}, { floor: 'cave-floor' }, bb);
    expect(DEFAULT_PALETTE).toEqual({ floor: 'floor', wall: 'wall' });
    expect(bb[LEVEL_PALETTE]).not.toBe(DEFAULT_PALETTE);
  });
});
