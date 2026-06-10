import { describe, it, expect, beforeEach } from 'vitest';
import { gameLog } from './game-log.js';

describe('gameLog singleton', () => {
  beforeEach(() => gameLog.reset());

  it('stamps entries with the current turn from the provider', () => {
    let turn = 3;
    gameLog.setTurnProvider(() => turn);
    gameLog.add({ display: 'a' });
    turn = 7;
    gameLog.add({ display: 'b' });

    const all = gameLog.getAll();
    expect(all.map(e => e.turn)).toEqual([3, 7]);
  });

  it('lets the caller override the stamped turn', () => {
    gameLog.setTurnProvider(() => 5);
    gameLog.add({ turn: 0, display: 'intro' });
    expect(gameLog.getAll()[0].turn).toBe(0);
  });

  it('getDisplayEntries returns only entries with a display string', () => {
    gameLog.add({ display: 'visible 1' });
    gameLog.add({ action: 'move' });            // debug-only, no display
    gameLog.add({ display: 'visible 2' });

    const lines = gameLog.getDisplayEntries(5).map(e => e.display);
    expect(lines).toEqual(['visible 1', 'visible 2']);
  });

  it('reset clears entries and restores the default turn provider', () => {
    gameLog.setTurnProvider(() => 99);
    gameLog.add({ display: 'x' });
    gameLog.reset();

    expect(gameLog.getAll()).toEqual([]);
    gameLog.add({ display: 'y' });
    expect(gameLog.getAll()[0].turn).toBe(0); // provider reset to default
  });
});
