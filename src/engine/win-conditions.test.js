import { describe, it, expect, beforeEach } from 'vitest';
import { winConditions, escapeWithQuestItem } from './win-conditions.js';

// Minimal fakes: entities are { components: Map }, the level just answers getEntitiesAt.
const entity = (entries) => ({ components: new Map(entries) });
const questItem = (id) => entity([['questItem', { id }]]);

function makeScene({ amulet = null, x = 5, y = 5, exitAt = null } = {}) {
  const items = amulet ? [amulet] : [];
  const player = entity([
    ['position', { x, y }],
    ['inventory', { items }],
  ]);
  const exitTile = exitAt ?? { x, y };
  const exit = entity([
    ['dungeonExit', {}],
    ['position', exitTile],
  ]);
  const level = {
    getEntitiesAt: (qx, qy) => new Set(qx === exitTile.x && qy === exitTile.y ? [exit] : []),
  };
  return { registry: {}, level, player };
}

describe('escapeWithQuestItem', () => {
  const condition = escapeWithQuestItem('amulet-of-yendor', 'You escaped!');

  it('wins when the player carries the quest item and stands on a dungeon exit', () => {
    const ctx = makeScene({ amulet: questItem('amulet-of-yendor') });
    expect(condition(ctx)).toEqual({ outcome: 'win', message: 'You escaped!' });
  });

  it('does not win without the quest item, even on the exit', () => {
    expect(condition(makeScene({ amulet: null }))).toBeNull();
  });

  it('does not win holding the quest item off the exit', () => {
    const ctx = makeScene({
      amulet: questItem('amulet-of-yendor'),
      x: 1,
      y: 1,
      exitAt: { x: 9, y: 9 },
    });
    expect(condition(ctx)).toBeNull();
  });

  it('does not win on a quest item with a different id', () => {
    const ctx = makeScene({ amulet: questItem('orb-of-zot') });
    expect(condition(ctx)).toBeNull();
  });
});

describe('winConditions registry', () => {
  beforeEach(() => winConditions.reset());

  it('returns the first non-null condition result', () => {
    winConditions.register('never', () => null);
    winConditions.register('always', () => ({ outcome: 'win', message: 'first hit' }));
    winConditions.register('second', () => ({ outcome: 'win', message: 'second hit' }));
    expect(winConditions.run({})).toEqual({ outcome: 'win', message: 'first hit' });
  });

  it('returns null when no condition is met', () => {
    winConditions.register('never', () => null);
    expect(winConditions.run({})).toBeNull();
  });

  it('reset clears registered conditions', () => {
    winConditions.register('always', () => ({ outcome: 'win' }));
    winConditions.reset();
    expect(winConditions.run({})).toBeNull();
  });
});
