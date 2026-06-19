import { describe, it, expect } from 'vitest';
import { trackScent } from './track-scent.js';

// Tracker at (5,5), faction scuttlers. `passable` controls level.isPassable.
function ctx(smells, { passable = () => true, x = 5, y = 5, factions = ['scuttlers'] } = {}) {
  return {
    selfState: { position: { x, y }, factions },
    perception: { smells },
    level: { isPassable: (px, py) => passable(px, py) },
  };
}

const smell = ({ profile = 'player', direction = 'E', intensity = 10 } = {}) => ({ profile, direction, intensity });

describe('trackScent', () => {
  it('steps toward a hostile scent gradient', () => {
    expect(trackScent.evaluate(ctx([smell({ direction: 'E' })])))
      .toEqual({ action: { type: 'move', x: 6, y: 5 } });
  });

  it('follows the strongest of several hostile scents', () => {
    const result = trackScent.evaluate(ctx([
      smell({ profile: 'player', direction: 'E', intensity: 5 }),
      smell({ profile: 'orcs', direction: 'W', intensity: 20 }),
    ]));
    expect(result).toEqual({ action: { type: 'move', x: 4, y: 5 } }); // orcs stronger → west
  });

  it('ignores its own faction\'s scent (not hostile)', () => {
    expect(trackScent.evaluate(ctx([smell({ profile: 'scuttlers', direction: 'E' })]))).toBeNull();
  });

  it('ignores a scent with no gradient (sitting on the source)', () => {
    expect(trackScent.evaluate(ctx([smell({ direction: null })]))).toBeNull();
  });

  it('returns null when the gradient step is blocked', () => {
    expect(trackScent.evaluate(ctx([smell({ direction: 'E' })], { passable: () => false }))).toBeNull();
  });

  it('returns null with no smells', () => {
    expect(trackScent.evaluate(ctx([]))).toBeNull();
  });
});
