import { describe, it, expect } from 'vitest';
import { areHostile } from './factions.js';

describe('areHostile', () => {
  it('is hostile when factions are disjoint', () => {
    expect(areHostile(['goblins'], ['orcs'])).toBe(true);
  });

  it('is friendly when factions share at least one tag', () => {
    expect(areHostile(['goblins'], ['goblins'])).toBe(false);
    expect(areHostile(['goblins', 'undead'], ['orcs', 'undead'])).toBe(false);
  });

  it('treats a factionless entity as hostile to everyone', () => {
    expect(areHostile([], ['goblins'])).toBe(true);
    expect(areHostile(['goblins'], [])).toBe(true);
    expect(areHostile([], [])).toBe(true);
  });

  it('handles missing faction lists', () => {
    expect(areHostile(undefined, ['goblins'])).toBe(true);
    expect(areHostile(['goblins'], undefined)).toBe(true);
  });
});
