import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeSettings, gameSettings, DEFAULT_SETTINGS } from './settings.js';

describe('normalizeSettings', () => {
  it('returns the defaults for null/missing input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a valid handedness value', () => {
    expect(normalizeSettings({ handedness: 'left' }).handedness).toBe('left');
  });

  it('falls back to the default for an invalid handedness value', () => {
    expect(normalizeSettings({ handedness: 'sideways' }).handedness).toBe('right');
  });

  it('drops unknown keys', () => {
    expect(normalizeSettings({ handedness: 'left', bogus: 1 })).toEqual({
      ...DEFAULT_SETTINGS,
      handedness: 'left',
    });
  });

  it('keeps a valid skipNewGameInstructions boolean', () => {
    expect(normalizeSettings({ skipNewGameInstructions: true }).skipNewGameInstructions).toBe(true);
  });

  it('falls back to the default for a non-boolean skipNewGameInstructions', () => {
    expect(normalizeSettings({ skipNewGameInstructions: 'yes' }).skipNewGameInstructions).toBe(
      false,
    );
  });

  it('defaults renderMode to sprite', () => {
    expect(normalizeSettings(null).renderMode).toBe('sprite');
  });

  it('keeps a valid renderMode value', () => {
    expect(normalizeSettings({ renderMode: 'glyph' }).renderMode).toBe('glyph');
  });

  it('falls back to the default for an invalid renderMode value', () => {
    expect(normalizeSettings({ renderMode: 'ascii' }).renderMode).toBe('sprite');
  });

  it('keeps an in-range volume', () => {
    expect(normalizeSettings({ musicVolume: 0.33 }).musicVolume).toBe(0.33);
  });

  it('clamps an out-of-range volume into [0,1]', () => {
    expect(normalizeSettings({ sfxVolume: 5 }).sfxVolume).toBe(1);
    expect(normalizeSettings({ masterVolume: -2 }).masterVolume).toBe(0);
  });

  it('falls back to the default volume for a non-numeric value', () => {
    expect(normalizeSettings({ musicVolume: 'loud' }).musicVolume).toBe(0.66);
  });
});

describe('gameSettings store', () => {
  beforeEach(() => {
    localStorage.clear();
    gameSettings.reset();
  });

  it('reads back a persisted value across a load', () => {
    gameSettings.set('handedness', 'left');
    gameSettings.reset();
    expect(gameSettings.get('handedness')).toBe('right'); // reset clears in-memory state
    gameSettings.load();
    expect(gameSettings.get('handedness')).toBe('left'); // load restores from storage
  });

  it('ignores an invalid set without changing the prior value', () => {
    gameSettings.set('handedness', 'left');
    gameSettings.set('handedness', 'nonsense');
    expect(gameSettings.get('handedness')).toBe('left');
  });

  // ENGINE-4 (B8): set() clamps an out-of-range volume into [0,1] and accepts it, matching load(),
  // rather than treating the clamp as a rejection and no-oping.
  it('clamps an out-of-range volume on set (matching load)', () => {
    gameSettings.set('masterVolume', 1.5);
    expect(gameSettings.get('masterVolume')).toBe(1);
    gameSettings.set('sfxVolume', -0.5);
    expect(gameSettings.get('sfxVolume')).toBe(0);
  });

  it('ignores a non-numeric volume set without changing the prior value', () => {
    gameSettings.set('musicVolume', 0.5);
    gameSettings.set('musicVolume', 'loud');
    expect(gameSettings.get('musicVolume')).toBe(0.5);
  });

  it('persists skipNewGameInstructions across a load', () => {
    gameSettings.set('skipNewGameInstructions', true);
    gameSettings.reset();
    expect(gameSettings.get('skipNewGameInstructions')).toBe(false); // reset clears in-memory state
    gameSettings.load();
    expect(gameSettings.get('skipNewGameInstructions')).toBe(true);
  });

  it('falls back to defaults when the store is corrupt', () => {
    localStorage.setItem('rogue:settings', '{not json');
    gameSettings.load();
    expect(gameSettings.get('handedness')).toBe('right');
  });
});
