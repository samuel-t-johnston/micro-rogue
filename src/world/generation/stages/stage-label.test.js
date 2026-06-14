import { describe, it, expect, vi } from 'vitest';
import { run as runLabel } from './stage-label.js';
import { createRng } from '../../../engine/rng.js';

// Hand-built zone set — the stage is geometry-agnostic, so it needn't come from the geometry stage.
function makeZones(n) {
  return Array.from({ length: n }, (_, id) => ({ id, cells: [[id, 0]], rect: {}, labels: ['room'] }));
}

function label(zones, seed = 123, config = {}) {
  runLabel(null, config, { 'level:zones': zones }, createRng(seed));
  return zones;
}

const countLabel = (zones, l) => zones.filter(z => z.labels.includes(l)).length;

describe('label stage', () => {
  it('assigns the default role labels with the right multiplicities', () => {
    const zones = label(makeZones(7));
    expect(countLabel(zones, 'stairs-up')).toBe(1);
    expect(countLabel(zones, 'stairs-down')).toBe(1);
    expect(countLabel(zones, 'treasure')).toBe(1);
    expect(countLabel(zones, 'item')).toBe(2);
  });

  it('labels 5 distinct zones, each keeping its base "room" label and one role', () => {
    const zones = label(makeZones(7));
    const special = zones.filter(z => z.labels.some(l => l !== 'room'));
    expect(special).toHaveLength(5);
    for (const z of special) {
      expect(z.labels[0]).toBe('room');
      expect(z.labels.filter(l => l !== 'room')).toHaveLength(1); // no zone gets two roles
    }
  });

  it('is deterministic for a given seed', () => {
    const a = label(makeZones(7), 42).map(z => z.labels.join(','));
    const b = label(makeZones(7), 42).map(z => z.labels.join(','));
    expect(a).toEqual(b);
  });

  it('honours a custom labels parameter', () => {
    const zones = label(makeZones(4), 1, { labels: ['boss', 'shop'] });
    expect(countLabel(zones, 'boss')).toBe(1);
    expect(countLabel(zones, 'shop')).toBe(1);
    expect(zones.filter(z => z.labels.length > 1)).toHaveLength(2);
  });

  it('skips trailing labels (with a warning) when there are too few zones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zones = label(makeZones(3)); // 3 zones, 5 default labels
    expect(zones.filter(z => z.labels.length > 1)).toHaveLength(3); // every zone got one role
    // Stairs are highest priority, so they're the ones that survive the shortage.
    expect(countLabel(zones, 'stairs-up')).toBe(1);
    expect(countLabel(zones, 'stairs-down')).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
