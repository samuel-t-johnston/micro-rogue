import { describe, it, expect } from 'vitest';
import { sfx } from './sfx.js';

// Under happy-dom audio is unavailable, so every play path takes the no-op branch. The contract these
// tests guard is exactly that: nothing throws, and play/loop always hand back a stoppable handle.

describe('no-op degradation', () => {
  it('load resolves without throwing when audio is unavailable', async () => {
    await expect(sfx.load({ blip: 'blip.mp3' })).resolves.toBeUndefined();
  });

  it('play returns a handle with a stop() method', () => {
    const handle = sfx.play('blip');
    expect(typeof handle.stop).toBe('function');
    expect(() => handle.stop()).not.toThrow();
  });

  it('play accepts options without throwing', () => {
    expect(() => sfx.play('blip', { volume: 0.5, rate: 1.2 })).not.toThrow();
  });

  it('loop returns a stoppable handle', () => {
    const handle = sfx.loop('hum');
    expect(typeof handle.stop).toBe('function');
    expect(() => handle.stop()).not.toThrow();
  });

  it('stopping a handle twice is safe', () => {
    const handle = sfx.play('blip');
    handle.stop();
    expect(() => handle.stop()).not.toThrow();
  });
});

describe('volume', () => {
  it('round-trips a set value', () => {
    sfx.setVolume(0.3);
    expect(sfx.getVolume()).toBe(0.3);
  });

  it('clamps out-of-range values', () => {
    sfx.setVolume(9);
    expect(sfx.getVolume()).toBe(1);
    sfx.setVolume(-1);
    expect(sfx.getVolume()).toBe(0);
  });
});

describe('mute', () => {
  it('round-trips and leaves volume untouched', () => {
    sfx.setVolume(0.6);
    sfx.setMuted(true);
    expect(sfx.isMuted()).toBe(true);
    expect(sfx.getVolume()).toBe(0.6);
    sfx.setMuted(false);
    expect(sfx.isMuted()).toBe(false);
  });
});
