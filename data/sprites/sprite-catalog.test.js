import { describe, it, expect } from 'vitest';
import { SPRITES, SHEETS } from './sprite-catalog.js';

describe('sprite catalog', () => {
  it('every sprite references a declared sheet', () => {
    for (const [name, entry] of Object.entries(SPRITES)) {
      expect(SHEETS[entry.sheet], `${name} → unknown sheet "${entry.sheet}"`).toBeDefined();
    }
  });

  it('every sprite has non-negative integer grid coordinates', () => {
    for (const [name, entry] of Object.entries(SPRITES)) {
      expect(Number.isInteger(entry.col) && entry.col >= 0, `${name}.col`).toBe(true);
      expect(Number.isInteger(entry.row) && entry.row >= 0, `${name}.row`).toBe(true);
    }
  });

  it('every declared sheet lists at least one positive size', () => {
    for (const [sheet, sizes] of Object.entries(SHEETS)) {
      expect(Array.isArray(sizes) && sizes.length > 0, `${sheet} sizes`).toBe(true);
      expect(sizes.every((s) => Number.isInteger(s) && s > 0), `${sheet} sizes`).toBe(true);
    }
  });
});
