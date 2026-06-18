import { describe, it, expect } from 'vitest';
import { obeyShouts } from './obey-shouts.js';

function sound({ understood = true, kind = 'enemy-report', direction = 'E' } = {}) {
  return { understood, message: { kind, direction } };
}

// Orc at (5,5). `passable` controls level.isPassable (default: everything open).
function ctx(sounds, memory = {}, { passable = () => true, x = 5, y = 5 } = {}) {
  return {
    memory,
    selfState: { position: { x, y } },
    perception: { entities: [], sounds },
    level: { isPassable: (px, py) => passable(px, py) },
  };
}

describe('obeyShouts', () => {
  it('steps one tile in the direction of an understood enemy report', () => {
    const result = obeyShouts.evaluate(ctx([sound({ direction: 'E' })]));
    expect(result).toEqual({ action: { type: 'move', x: 6, y: 5 } });
  });

  it('maps a northern order to a smaller y (y-down grid)', () => {
    const result = obeyShouts.evaluate(ctx([sound({ direction: 'N' })]));
    expect(result).toEqual({ action: { type: 'move', x: 5, y: 4 } });
  });

  it('ignores an order in a language it does not understand', () => {
    expect(obeyShouts.evaluate(ctx([sound({ understood: false })]))).toBeNull();
  });

  it('ignores sounds that are not enemy reports', () => {
    expect(obeyShouts.evaluate(ctx([sound({ kind: 'taunt' })]))).toBeNull();
  });

  it('keeps advancing on the last heading for a few turns after the sound fades', () => {
    const memory = {};
    obeyShouts.evaluate(ctx([sound({ direction: 'E' })], memory)); // hears the order
    const next = obeyShouts.evaluate(ctx([], memory));             // no sound now
    expect(next).toEqual({ action: { type: 'move', x: 6, y: 5 } });
  });

  it('lapses the heading after its persistence runs out', () => {
    const memory = {};
    obeyShouts.evaluate(ctx([sound({ direction: 'E' })], memory)); // sets headingTurns = 4
    for (let i = 0; i < 4; i++) obeyShouts.evaluate(ctx([], memory)); // drain it
    expect(obeyShouts.evaluate(ctx([], memory))).toBeNull();
  });

  it('returns null when the heading tile is blocked', () => {
    const result = obeyShouts.evaluate(ctx([sound({ direction: 'E' })], {}, { passable: () => false }));
    expect(result).toBeNull();
  });
});
