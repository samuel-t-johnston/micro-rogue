import { describe, it, expect, beforeEach } from 'vitest';
import { initAudio, applyAudioSettings, setAudioVolume } from './audio-settings.js';
import { gameSettings } from '../engine/config/settings.js';

// The glue only reads gameSettings and calls the audio setters (no-ops under happy-dom), so the
// observable behavior to pin is that it persists settings and never throws.

describe('audio settings glue', () => {
  beforeEach(() => {
    localStorage.clear();
    gameSettings.reset();
  });

  it('initAudio loads manifests and applies settings without throwing', () => {
    expect(() => initAudio()).not.toThrow();
  });

  it('applyAudioSettings is safe to call repeatedly', () => {
    expect(() => {
      applyAudioSettings();
      applyAudioSettings();
    }).not.toThrow();
  });

  it('setAudioVolume persists the value to gameSettings', () => {
    setAudioVolume('musicVolume', 0.33);
    expect(gameSettings.get('musicVolume')).toBe(0.33);
  });

  it('setAudioVolume clamps an out-of-range value via the store', () => {
    setAudioVolume('sfxVolume', 9);
    expect(gameSettings.get('sfxVolume')).toBe(1);
  });
});
