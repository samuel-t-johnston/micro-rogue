import { describe, it, expect } from 'vitest';
import { pickSheetSize, resolveDraw } from './sprite-renderer.js';

// Picks the source sheet for a given device-pixel tile target. The goal is the most detailed
// sheet that still scales up by a clean integer factor (crisp pixel art); when nothing divides
// evenly (fractional DPR), the largest sheet that doesn't exceed the target, to minimise scaling.
describe('pickSheetSize', () => {
  const sizes = [16, 32];

  it('uses the 16px sheet at a 16px target', () => {
    expect(pickSheetSize(16, sizes)).toBe(16);
  });

  it('prefers the larger sheet when it divides the target evenly (more detail)', () => {
    expect(pickSheetSize(32, sizes)).toBe(32); // 32×1 native, not 16×2
    expect(pickSheetSize(64, sizes)).toBe(32); // 32×2, not 16×4
    expect(pickSheetSize(96, sizes)).toBe(32); // 48px @ dpr2 → 32×3
    expect(pickSheetSize(128, sizes)).toBe(32); // 64px @ dpr2 → 32×4
  });

  it('falls back to a smaller sheet when the larger one would not scale cleanly', () => {
    expect(pickSheetSize(48, sizes)).toBe(16); // 48px @ dpr1: 48%32≠0, 48%16=0 → 16×3
    expect(pickSheetSize(144, sizes)).toBe(16); // 48px @ dpr3: 144%32≠0, 144%16=0 → 16×9
  });

  it('handles fractional DPR by using the largest sheet not exceeding the target', () => {
    expect(pickSheetSize(40, sizes)).toBe(32); // no clean divisor; 32 ≤ 40 < 64-equivalent
    expect(pickSheetSize(20, sizes)).toBe(16); // 32 > 20 → step down to 16
  });

  it('uses the smallest sheet when every sheet is larger than the target', () => {
    expect(pickSheetSize(8, sizes)).toBe(16);
  });
});

// Resolves a catalog name + device-pixel target to the source-sheet draw it implies. The source
// rect (sx, sy) is the cell scaled by the chosen sheet size, so it tracks which size was picked.
describe('resolveDraw', () => {
  const catalog = {
    floor: { sheet: 'sprite-sheet', col: 2, row: 0 },
    knight: { sheet: 'knight', col: 1, row: 3 },
  };
  const sheets = { 'sprite-sheet': [16, 32], knight: [16] };

  it('returns null for an unknown name (caller falls back to glyph/color)', () => {
    expect(resolveDraw('nonexistent', 32, { catalog, sheets })).toBeNull();
  });

  it('picks the best sheet size for the target and scales the cell to it', () => {
    // 32px target on a multi-size sheet → 32px sheet; cell (2,0) → source (64, 0).
    expect(resolveDraw('floor', 32, { catalog, sheets })).toEqual({
      sheet: 'sprite-sheet',
      size: 32,
      sx: 64,
      sy: 0,
    });
    // 16px target → 16px sheet; cell (2,0) → source (32, 0).
    expect(resolveDraw('floor', 16, { catalog, sheets })).toEqual({
      sheet: 'sprite-sheet',
      size: 16,
      sx: 32,
      sy: 0,
    });
  });

  it('uses a single-size sheet at any target', () => {
    expect(resolveDraw('knight', 64, { catalog, sheets })).toEqual({
      sheet: 'knight',
      size: 16,
      sx: 16,
      sy: 48,
    });
  });
});
