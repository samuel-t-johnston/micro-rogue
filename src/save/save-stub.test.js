import { describe, it, expect } from 'vitest';
import { hasSave, getSaveMeta } from './save-stub.js';

describe('save stub', () => {
  it('reports no save', () => {
    expect(hasSave()).toBe(false);
  });

  it('returns null meta', () => {
    expect(getSaveMeta()).toBeNull();
  });
});
