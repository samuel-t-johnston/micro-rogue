# Sprite Sheets

*How sprites are referenced, how the sheet is selected, and how to add new sizes.*

## Sheet naming and location

Sprite sheets live in [`assets/sprites/`](../../assets/sprites/) and follow the naming convention:

```
sprite-sheet-{tileSize}.png
```

`tileSize` is read from `gameConfig.tileSize` in [`src/engine/game-config.js`](../../src/engine/game-config.js). The default is `32`, so the default sheet is `sprite-sheet-32.png`. Changing `tileSize` automatically switches which sheet is loaded — no other code changes needed.

## Sprite references

Each tile type in [`data/tiles/terrain.js`](../../data/tiles/terrain.js) carries a `sprite: { col, row }` field. Both values are 0-indexed, measured in tiles from the top-left corner of the sheet.

For a 32×32 sheet, `{ col: 2, row: 0 }` is the sprite starting at pixel `(64, 0)`.

The `{col, row}` reference is size-agnostic — the same coordinates address the same logical sprite on a 16px sheet and a 64px sheet. Only the sheet file differs between sizes.

## Add a new tile size

1. Add a sprite sheet at `assets/sprites/sprite-sheet-{newSize}.png` with sprites laid out on a `{newSize} × {newSize}` grid.
2. Update `gameConfig.tileSize` to the new value.

The renderer reads `tileSize` at startup and loads the matching sheet.

## Color fallback

If the sprite sheet hasn't finished loading, or a tile type has no `sprite` field, the renderer fills the tile with `tile.color` instead. This means:

- The map renders immediately, before assets arrive.
- A tile with no `sprite` field uses its color permanently — useful for placeholder tiles during development.

Don't rely on the fallback for shipped tiles. Define a `sprite` for every tile type; the fallback is a loading-state safety net.

## Worth knowing

- **All sheet sizes must share the same grid layout.** If `{ col: 1, row: 5 }` is a wall on the 32px sheet, it must be a wall at the same position on any other size you add. Tile IDs and sprite coordinates are shared across sizes.
- **Sheets are loaded once per session.** Swapping out a sheet file during play has no effect until the page reloads.
