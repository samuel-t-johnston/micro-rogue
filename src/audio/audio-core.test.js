import { describe, it, expect } from 'vitest';
import {
  isAvailable,
  ensureContext,
  getContext,
  getSfxBus,
  getMusicBus,
  onReady,
  onRunning,
  setMasterVolume,
  getMasterVolume,
  setMasterMuted,
  isMasterMuted,
} from './audio-core.js';

// happy-dom provides no AudioContext, so the whole module runs its unavailable / no-op path. These
// tests pin the safety contract (nothing throws, the graph stays null) and the master state holders,
// which work regardless of whether real audio exists.

describe('availability', () => {
  it('reports unavailable when there is no AudioContext (happy-dom)', () => {
    expect(isAvailable()).toBe(false);
  });

  it('ensureContext returns null when unavailable', () => {
    expect(ensureContext()).toBeNull();
    expect(getContext()).toBeNull();
  });

  it('exposes no buses when the graph was never built', () => {
    expect(getSfxBus()).toBeNull();
    expect(getMusicBus()).toBeNull();
  });
});

describe('master volume', () => {
  it('round-trips a set value', () => {
    setMasterVolume(0.4);
    expect(getMasterVolume()).toBe(0.4);
  });

  it('clamps above 1 and below 0', () => {
    setMasterVolume(5);
    expect(getMasterVolume()).toBe(1);
    setMasterVolume(-2);
    expect(getMasterVolume()).toBe(0);
  });

  it('treats a non-numeric value as 0', () => {
    setMasterVolume(NaN);
    expect(getMasterVolume()).toBe(0);
  });
});

describe('master mute', () => {
  it('round-trips and is independent of volume', () => {
    setMasterVolume(0.7);
    setMasterMuted(true);
    expect(isMasterMuted()).toBe(true);
    expect(getMasterVolume()).toBe(0.7); // muting must not disturb the slider position
    setMasterMuted(false);
    expect(isMasterMuted()).toBe(false);
  });

  it('coerces truthy/falsy inputs to a boolean', () => {
    setMasterMuted(1);
    expect(isMasterMuted()).toBe(true);
    setMasterMuted(0);
    expect(isMasterMuted()).toBe(false);
  });
});

describe('hooks', () => {
  it('does not fire onReady immediately when the graph does not exist', () => {
    let called = false;
    expect(() => onReady(() => (called = true))).not.toThrow();
    expect(called).toBe(false); // no graph under happy-dom
  });

  it('does not fire onRunning immediately when there is no running context', () => {
    let called = false;
    expect(() => onRunning(() => (called = true))).not.toThrow();
    expect(called).toBe(false);
  });
});
