# Sprite Sheets

*How sprites are named and referenced, how a sheet is chosen, and how to add art or new sizes.*

## The catalog: one named list

Every sprite is declared once in [`data/sprites/sprite-catalog.js`](../../data/sprites/sprite-catalog.js).
Renderables and tiles reference a sprite **by name** (a string), never by raw coordinates:

```js
export const SPRITES = {
  'healing-potion': { sheet: 'sprite-sheet', col: 16, row: 16 },
  // …
};
```

- `sheet` is a sheet base name (see SHEETS below).
- `col`/`row` are 0-indexed **grid cells** (not pixels), so the same cell addresses the same logical
  sprite on every size of its sheet.

A `renderable` component stores the sprite name in its `sprite` field (or `null` for glyph-only
entities); a tile type stores it in `sprite`. The door's `openable` holds the `door-closed` /
`door-open` names it swaps between.

## Sheets and sizes

`SHEETS` declares each sheet's available pixel sizes:

```js
export const SHEETS = {
  'sprite-sheet': [16, 32],   // a "family": same art at two resolutions
  potions: [16],              // single size is fine
};
```

A sheet file is named `assets/sprites/${name}-${size}.png` (e.g. `sprite-sheet-32.png`,
`potions-16.png`). A sheet may ship at several sizes — a **family** — so the renderer can pick the
crispest one for the current zoom/DPR, but a single size is the common case. Only sheets actually
referenced by `SPRITES` are loaded.

## Sheet selection

`pickSheetSize` (in [`sprite-renderer.js`](../../src/render/sprite-renderer.js)) chooses, per draw,
the largest size of the sprite's sheet that upscales to the on-screen device-pixel size
(`tile size × dpr`) by a whole number — maximum detail while staying pixel-crisp. A single-size
sheet always uses that size. The renderer sets `imageSmoothingEnabled = false` so scaling is
nearest-neighbor. See [zoom.md](zoom.md).

## Render mode: sprites or ASCII

The **Graphics** setting (`renderMode`, in [`settings.js`](../../src/engine/settings.js)) switches
between `sprite` (default) and `glyph` (classic ASCII). The renderer reads it live, so toggling it
in Settings takes effect on the next frame. In glyph mode the renderer skips sprites entirely and
draws each renderable's/tile's `glyph` in `glyphColor` over its `color`.

## Fallback (and graceful tolerance)

If a sprite name doesn't resolve in the catalog, or its sheet hasn't loaded yet, `draw` returns
false and the renderer falls back to the same glyph/color fill used by ASCII mode. This means:

- The map renders immediately, before assets arrive.
- An unknown or removed sprite name never crashes — it just shows the glyph. (This is also why old
  saves with stale sprite references stay safe; see the v4→v5 migration in
  [`save-system.js`](../../src/save/save-system.js).)

Define a `sprite` **and** a `glyph` for every visible entity. The catalog's own test
([`sprite-catalog.test.js`](../../data/sprites/sprite-catalog.test.js)) checks every entry resolves
to a declared sheet; an entity-level audit keeps both fields present on each renderable.

## Add art

1. Drop the sheet at `assets/sprites/${name}-${size}.png`.
2. Declare it in `SHEETS` (with each size it ships at).
3. Add catalog entries in `SPRITES` mapping names → `{ sheet, col, row }`.
4. Reference the name from a `renderable`/tile.

## Add a new size to an existing sheet

Add a `${name}-${newSize}.png` laid out on the same grid, and add `newSize` to that sheet's
`SHEETS` array. Coordinates are shared across sizes, so nothing else changes; the renderer starts
using it wherever it's the crispest fit.
