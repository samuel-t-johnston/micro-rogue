const TOKEN_MAP = {
  bg: '--color-bg',
  surface: '--color-surface',
  primary: '--color-primary',
  accent: '--color-accent',
  text: '--color-text',
  textDim: '--color-text-dim',
  textDisabled: '--color-text-disabled',
  debug: '--color-debug',
};

export function readTheme(root = document.documentElement) {
  const styles = getComputedStyle(root);
  const theme = {};
  for (const [key, prop] of Object.entries(TOKEN_MAP)) {
    theme[key] = styles.getPropertyValue(prop).trim();
  }
  return theme;
}

export const THEME_TOKENS = Object.freeze({ ...TOKEN_MAP });
