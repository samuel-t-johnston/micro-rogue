import { describe, it, expect } from 'vitest';
import { describeSmell } from './smell-text.js';

describe('describeSmell', () => {
  it('flavors a noteworthy profile with the smelled direction', () => {
    expect(describeSmell({ profile: 'orcs', direction: 'N' })).toBe('You smell the stench of orcs to the north.');
  });

  it('falls back to "nearby" when there is no direction', () => {
    expect(describeSmell({ profile: 'orcs', direction: null })).toBe('You smell the stench of orcs nearby.');
  });

  it('returns null for a profile that is not noteworthy (no flavor entry)', () => {
    expect(describeSmell({ profile: 'scuttlers', direction: 'N' })).toBeNull();
  });
});
