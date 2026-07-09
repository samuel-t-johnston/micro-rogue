import { describe, it, expect } from 'vitest';
import { vignetteAlpha } from './vignette.js';

// The gold level-up spec and a red two-pulse "heartbeat" — the two shapes the feature targets.
const SINGLE = { pulses: 1, pulseLength: 3000, maxAlpha: 0.55 };
const HEARTBEAT = { pulses: 2, pulseLength: 300, maxAlpha: 0.6 };

describe('vignetteAlpha', () => {
  it('is zero before it starts and once it has finished', () => {
    expect(vignetteAlpha(0, SINGLE)).toBe(0);
    expect(vignetteAlpha(-100, SINGLE)).toBe(0);
    expect(vignetteAlpha(3000, SINGLE)).toBe(0); // exactly at total
    expect(vignetteAlpha(4000, SINGLE)).toBe(0); // past total
  });

  it('is positive while running and never exceeds maxAlpha', () => {
    for (let e = 1; e < 3000; e += 137) {
      const a = vignetteAlpha(e, SINGLE);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThanOrEqual(SINGLE.maxAlpha + 1e-9);
    }
  });

  it('peaks at maxAlpha at the end of the rise', () => {
    const peak = vignetteAlpha(0.2 * SINGLE.pulseLength, SINGLE); // RISE = 0.2 of the pulse
    expect(peak).toBeCloseTo(SINGLE.maxAlpha, 5);
  });

  it('splits a two-pulse run into two separated bumps', () => {
    // Trough at the boundary between the pulses, a fresh peak inside the second pulse.
    expect(vignetteAlpha(HEARTBEAT.pulseLength, HEARTBEAT)).toBeCloseTo(0, 5);
    const secondPeak = vignetteAlpha(1.2 * HEARTBEAT.pulseLength, HEARTBEAT);
    expect(secondPeak).toBeCloseTo(HEARTBEAT.maxAlpha, 5);
  });

  it('defaults maxAlpha when omitted', () => {
    const a = vignetteAlpha(0.2 * 1000, { pulses: 1, pulseLength: 1000 });
    expect(a).toBeCloseTo(0.55, 5); // DEFAULT_MAX_ALPHA
  });
});
