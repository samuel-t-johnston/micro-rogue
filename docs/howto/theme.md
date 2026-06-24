# Theme

*How the theme works and how to change it.*

The theme is a small set of CSS custom properties on `:root`. CSS surfaces (page background, future DOM overlays) read them directly via `var(--color-...)`. Canvas drawing code reads them once at boot via [`readTheme()`](../../src/engine/config/theme.js) into a plain JS object, then passes that object to UI primitives in [`canvas-ui.js`](../../src/ui/core/canvas-ui.js).

The token set is kept deliberately small. Add a new token only when a concrete UI element needs one that doesn't fit an existing slot — resist pre-defining tokens like `--color-warning` or `--color-success` until something actually uses them.

## The tokens

| CSS property             | JS key          | Purpose                                  |
| ------------------------ | --------------- | ---------------------------------------- |
| `--color-bg`             | `bg`            | Page and canvas background               |
| `--color-surface`        | `surface`       | Panels, menu backgrounds, modal surfaces |
| `--color-primary`        | `primary`       | Default button fill, primary UI accents  |
| `--color-accent`         | `accent`        | Highlights, hover states, selected items |
| `--color-text`           | `text`          | Body text                                |
| `--color-text-dim`       | `textDim`       | Secondary text, labels, ghost log lines  |
| `--color-text-disabled`  | `textDisabled`  | Disabled button labels                   |
| `--color-debug`          | `debug`         | Debug-only / unseen lines in the log overlay |

## Change a color value

Edit [`styles/theme.css`](../../styles/theme.css). That's it — JS picks up new values on next reload.

If the new palette affects the browser chrome (status bar tint, splash background on PWA install), also update:
- [`manifest.json`](../../manifest.json) → `background_color` (matches `--color-bg`) and `theme_color` (typically matches `--color-surface`)
- [`index.html`](../../index.html) → `<meta name="theme-color">` (matches `manifest.json` `theme_color`)

## Add a new token

Only do this when an existing slot doesn't fit. Adding speculative tokens leads to drift.

1. Add the CSS property to [`styles/theme.css`](../../styles/theme.css).
2. Add an entry to `TOKEN_MAP` in [`src/engine/config/theme.js`](../../src/engine/config/theme.js) so canvas code can read it as a JS key.
3. Extend the fixture and assertions in [`src/engine/config/theme.test.js`](../../src/engine/config/theme.test.js).
4. Reference the new key in the consuming canvas code (or `var(--...)` in CSS).

## Worth knowing

- **The theme is read once at boot.** Live theme switching isn't wired yet. Reloading the page picks up CSS changes; changing values at runtime won't propagate to the canvas until you re-read.
- **`getComputedStyle` returns padded strings.** `readTheme()` calls `.trim()` for you — match that pattern if you read tokens elsewhere.
- **Same fill and text color = invisible label.** [`drawButton`](../../src/ui/core/canvas-ui.js) deliberately uses `theme.bg` for labels sitting on `theme.primary` or `theme.accent` fills. If you introduce a new button style with a different fill, pick a contrasting text color explicitly — there is no `--color-on-primary` slot.
