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
    expect(normalizeSettings({ handedness: 'left', bogus: 1 }))
      .toEqual({ ...DEFAULT_SETTINGS, handedness: 'left' });
  });

  it('keeps a valid skipNewGameInstructions boolean', () => {
    expect(normalizeSettings({ skipNewGameInstructions: true }).skipNewGameInstructions).toBe(true);
  });

  it('falls back to the default for a non-boolean skipNewGameInstructions', () => {
    expect(normalizeSettings({ skipNewGameInstructions: 'yes' }).skipNewGameInstructions).toBe(false);
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
