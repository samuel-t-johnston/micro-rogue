import { describe, it, expect, beforeEach } from 'vitest';
import { playerHear } from './player-hear.js';
import { gameLog } from '../../engine/log/game-log.js';

function ctx(sounds, memory = {}, visibleTiles = new Set()) {
  return { memory, perception: { sounds, visibleTiles } };
}

function heardLines() {
  return gameLog
    .getAll()
    .filter((e) => e.action === 'hear')
    .map((e) => e.display);
}

const sound = (soundId, extra = {}) => ({
  soundId,
  position: { x: 9, y: 9 },
  perceivedDirection: 'N',
  language: 'orcish',
  understood: false,
  message: {},
  ...extra,
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

  it('does not log a sound whose origin tile is currently visible', () => {
    playerHear.evaluate(ctx([sound(1)], {}, new Set(['9,9'])));
    expect(heardLines()).toHaveLength(0);
  });

  it('logs a sound whose origin is not currently visible', () => {
    playerHear.evaluate(ctx([sound(1)], {}, new Set(['0,0'])));
    expect(heardLines()).toHaveLength(1);
  });
});
