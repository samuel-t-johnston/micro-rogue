import { describe, it, expect } from 'vitest';
import { isEntryVisible } from './log-visibility.js';

// Simple stand-ins for the lookups the game scene supplies.
const PLAYER = 1;
function deps({ visible = ['5,5'], positions = {} } = {}) {
  return {
    playerId: PLAYER,
    visibleTiles: new Set(visible),
    getPosition: (id) => positions[id] ?? null,
  };
}

describe('isEntryVisible', () => {
  it('always shows entries where the player is the actor', () => {
    expect(isEntryVisible({ actor: PLAYER }, deps())).toBe(true);
  });

  it('always shows entries where the player is the target', () => {
    // Goblin (off-screen) hits the player — still shown.
    expect(isEntryVisible({ actor: 2, target: PLAYER }, deps({ positions: { 2: { x: 0, y: 0 } } }))).toBe(true);
  });

  it('shows everything when there is no FOV data', () => {
    expect(isEntryVisible({ actor: 2 }, { playerId: PLAYER, visibleTiles: null, getPosition: () => ({ x: 0, y: 0 }) })).toBe(true);
  });

  it('hides an NPC-vs-NPC entry when neither combatant is on a visible tile', () => {
    const entry = { actor: 2, target: 3 };
    const d = deps({ visible: ['5,5'], positions: { 2: { x: 0, y: 0 }, 3: { x: 1, y: 0 } } });
    expect(isEntryVisible(entry, d)).toBe(false);
  });

  it('shows an NPC-vs-NPC entry when ANY combatant is on a visible tile', () => {
    const entry = { actor: 2, target: 3 };
    const d = deps({ visible: ['1,0'], positions: { 2: { x: 0, y: 0 }, 3: { x: 1, y: 0 } } });
    expect(isEntryVisible(entry, d)).toBe(true);
  });

  it('uses an explicit snapshot pos (e.g. a death after teardown) over a missing entity', () => {
    // Entity 2 is gone (getPosition returns null), but the death line snapshotted its tile.
    const visibleDeath = { actor: 2, pos: { x: 5, y: 5 } };
    const hiddenDeath = { actor: 2, pos: { x: 0, y: 0 } };
    expect(isEntryVisible(visibleDeath, deps({ visible: ['5,5'] }))).toBe(true);
    expect(isEntryVisible(hiddenDeath, deps({ visible: ['5,5'] }))).toBe(false);
  });

  it('treats entries with no spatial anchor as global narration (always shown)', () => {
    expect(isEntryVisible({ display: 'You enter the dungeon.' }, deps())).toBe(true);
  });
});
