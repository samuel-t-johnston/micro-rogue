/**
 * @file Color theme tokens and live CSS custom-property values. These are used across the UI for consistent theming,
 * and can be read live from the DOM to support dynamic theme switching.
 */

const TOKEN_MAP = {
  bg: '--color-bg',
  surface: '--color-surface',
  primary: '--color-primary',
  accent: '--color-accent',
  text: '--color-text',
  textDim: '--color-text-dim',
  textDisabled: '--color-text-disabled',
  debug: '--color-debug',
  health: '--color-health',
  magic: '--color-magic',
  experience: '--color-experience',
};

/** Reads the live CSS custom-property theme values into a plain `{ token: value }` object. */
export function readTheme(root = document.documentElement) {
  const styles = getComputedStyle(root);
  const theme = {};
  for (const [key, prop] of Object.entries(TOKEN_MAP)) {
    theme[key] = styles.getPropertyValue(prop).trim();
  }
  return theme;
}

/** Frozen map of theme token → CSS custom-property name. */
export const THEME_TOKENS = Object.freeze({ ...TOKEN_MAP });
