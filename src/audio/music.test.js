import { describe, it, expect, vi } from 'vitest';
import { music } from './music.js';

// happy-dom has no AudioContext, so play() reaches ensureContext(), gets null, and bails before any
// <audio> element is created. These tests guard the no-op contract and the volume/mute state.

describe('no-op degradation', () => {
  it('load registers tracks without throwing', () => {
    expect(() => music.load({ theme: 'theme.mp3' })).not.toThrow();
  });

  it('playing a known track is a silent no-op when audio is unavailable', () => {
    music.load({ theme: 'theme.mp3' });
    expect(() => music.play('theme')).not.toThrow();
  });

  it('warns and no-ops on an unknown track', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => music.play('does-not-exist')).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stop is safe with nothing playing', () => {
    expect(() => music.stop()).not.toThrow();
    expect(() => music.stop({ fade: 200 })).not.toThrow();
  });
});

describe('volume', () => {
  it('round-trips a set value', () => {
    music.setVolume(0.5);
    expect(music.getVolume()).toBe(0.5);
  });

  it('clamps out-of-range values', () => {
    music.setVolume(3);
    expect(music.getVolume()).toBe(1);
    music.setVolume(-4);
    expect(music.getVolume()).toBe(0);
  });
});

describe('mute', () => {
  it('round-trips and leaves volume untouched', () => {
    music.setVolume(0.8);
    music.setMuted(true);
    expect(music.isMuted()).toBe(true);
    expect(music.getVolume()).toBe(0.8);
    music.setMuted(false);
    expect(music.isMuted()).toBe(false);
  });
});
