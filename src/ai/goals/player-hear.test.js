import { describe, it, expect, beforeEach } from 'vitest';
import { playerHear } from './player-hear.js';
import { gameLog } from '../../engine/game-log.js';

function ctx(sounds, memory = {}) {
  return { memory, perception: { sounds } };
}

function heardLines() {
  return gameLog.getAll().filter(e => e.action === 'hear').map(e => e.display);
}

const sound = (soundId, extra = {}) => ({
  soundId, perceivedDirection: 'N', language: 'orcish', understood: false, message: {}, ...extra,
});

describe('playerHear', () => {
  beforeEach(() => gameLog.reset());

  it('always returns null (it never acts, only logs)', () => {
    expect(playerHear.evaluate(ctx([sound(1)]))).toBeNull();
  });

  it('logs a "you hear" line for a newly heard sound', () => {
    playerHear.evaluate(ctx([sound(1)]));
    expect(heardLines()).toEqual(['You hear guttural orcish shouting to the north.']);
  });

  it('does not log the same lingering sound twice across turns', () => {
    const memory = {};
    playerHear.evaluate(ctx([sound(1)], memory)); // turn 1
    playerHear.evaluate(ctx([sound(1)], memory)); // turn 2 — same sound still perceived
    expect(heardLines()).toHaveLength(1);
  });

  it('logs a distinct new sound on a later turn', () => {
    const memory = {};
    playerHear.evaluate(ctx([sound(1)], memory));
    playerHear.evaluate(ctx([sound(2)], memory)); // sound 1 gone, sound 2 new
    expect(heardLines()).toHaveLength(2);
  });

  it('prunes remembered ids to currently-heard sounds so the set stays bounded', () => {
    const memory = {};
    playerHear.evaluate(ctx([sound(1)], memory));
    playerHear.evaluate(ctx([], memory)); // nothing heard now
    expect(memory.heardSoundIds).toEqual([]);
  });
});
