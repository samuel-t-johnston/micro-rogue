import { describe, it, expect } from 'vitest';
import { describeSound } from './sound-text.js';

describe('describeSound', () => {
  it('describes an un-understood vocalization by its language, not its meaning', () => {
    const line = describeSound({
      perceivedDirection: 'N', language: 'orcish', understood: false,
      message: { kind: 'enemy-report', direction: 'NW' },
    });
    expect(line).toBe('You hear guttural orcish shouting to the north.');
  });

  it('decodes an understood order, including the shouted (semantic) direction', () => {
    const line = describeSound({
      perceivedDirection: 'E', language: 'orcish', understood: true,
      message: { kind: 'enemy-report', direction: 'NW' },
    });
    expect(line).toBe('You hear a shout: an enemy to the northwest to the east.');
  });

  it('describes a non-verbal sound generically', () => {
    const line = describeSound({ perceivedDirection: 'S', language: null, understood: true, message: null });
    expect(line).toBe('You hear a noise to the south.');
  });

  it('describes a non-verbal movement noise by its kind', () => {
    const line = describeSound({ perceivedDirection: 'E', language: null, understood: true, message: { kind: 'vermin-scrabble' } });
    expect(line).toBe('You hear the scrabbling of vermin to the east.');
  });

  it('describes a combat clash', () => {
    const line = describeSound({ perceivedDirection: 'N', language: null, understood: true, message: { kind: 'combat' } });
    expect(line).toBe('You hear fighting to the north.');
  });

  it('falls back to "nearby" when there is no direction', () => {
    const line = describeSound({ perceivedDirection: null, language: 'orcish', understood: false });
    expect(line).toBe('You hear guttural orcish shouting nearby.');
  });
});
