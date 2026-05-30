import { describe, it, expect, beforeEach } from 'vitest';
import { readTheme, THEME_TOKENS } from './theme.js';

describe('readTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = `
      --color-bg: #0a0e0a;
      --color-surface: #111811;
      --color-primary: #00ff41;
      --color-accent: #39ff7a;
      --color-text: #00ff41;
      --color-text-dim: #4a7a4a;
      --color-text-disabled: #1f3a1f;
    `;
  });

  it('exposes the full token map', () => {
    expect(Object.keys(THEME_TOKENS)).toEqual([
      'bg',
      'surface',
      'primary',
      'accent',
      'text',
      'textDim',
      'textDisabled',
    ]);
  });

  it('reads CSS custom properties into a typed object', () => {
    const theme = readTheme();
    expect(theme.bg).toBe('#0a0e0a');
    expect(theme.surface).toBe('#111811');
    expect(theme.primary).toBe('#00ff41');
    expect(theme.accent).toBe('#39ff7a');
    expect(theme.text).toBe('#00ff41');
    expect(theme.textDim).toBe('#4a7a4a');
    expect(theme.textDisabled).toBe('#1f3a1f');
  });

  it('trims whitespace from CSS values', () => {
    document.documentElement.style.cssText = '--color-bg:   #abcdef  ;';
    const theme = readTheme();
    expect(theme.bg).toBe('#abcdef');
  });
});
