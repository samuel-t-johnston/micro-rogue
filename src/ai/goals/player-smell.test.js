import { describe, it, expect, beforeEach } from 'vitest';
import { playerSmell } from './player-smell.js';
import { gameLog } from '../../engine/game-log.js';

function ctx(smells, memory = {}, factions = ['player']) {
  return { memory, selfState: { factions }, perception: { smells } };
}

function smelledLines() {
  return gameLog
    .getAll()
    .filter((e) => e.action === 'smell')
    .map((e) => e.display);
}

const smell = (profile, direction = 'N') => ({ profile, direction, intensity: 10 });

describe('playerSmell', () => {
  beforeEach(() => gameLog.reset());

  it('always returns null (never acts, only logs)', () => {
    expect(playerSmell.evaluate(ctx([smell('orcs')]))).toBeNull();
  });

  it('logs a "you smell" line for a noteworthy scent', () => {
    playerSmell.evaluate(ctx([smell('orcs')]));
    expect(smelledLines()).toEqual(['You smell the stench of orcs to the north.']);
  });

  it("does not log the player's own scent profile", () => {
    playerSmell.evaluate(ctx([smell('player')]));
    expect(smelledLines()).toHaveLength(0);
  });

  it('does not log a profile smell-text deems unremarkable', () => {
    playerSmell.evaluate(ctx([smell('scuttlers')]));
    expect(smelledLines()).toHaveLength(0);
  });

  it('does not re-log a lingering scent across turns', () => {
    const memory = {};
    playerSmell.evaluate(ctx([smell('orcs')], memory));
    playerSmell.evaluate(ctx([smell('orcs')], memory));
    expect(smelledLines()).toHaveLength(1);
  });

  it('prunes remembered profiles to currently-smelled ones', () => {
    const memory = {};
    playerSmell.evaluate(ctx([smell('orcs')], memory));
    playerSmell.evaluate(ctx([], memory));
    expect(memory.smelledProfiles).toEqual([]);
  });
});
