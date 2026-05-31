# Tile Types

*How tiles are defined and how to add new ones.*

Tile types live in [`data/tiles/terrain.js`](../../data/tiles/terrain.js) as a plain object keyed by tile ID. Each entry describes a single kind of terrain: its display properties, movement rules, and sprite location.

## Fields

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Human-readable name (used in UI labels and debug overlay) |
| `symbol` | string | Single character used in map text files |
| `color` | CSS color string | Fallback fill when the sprite sheet isn't ready or `sprite` is absent |
| `passable` | boolean | Whether entities can move through this tile |
| `opaque` | boolean | Whether this tile blocks line of sight |
| `sprite` | `{ col, row }` | Sprite location in the sheet (0-indexed column and row; see [sprite-sheets.md](sprite-sheets.md)) |

## Symbol vs. tile ID

The tile ID is the registry key — it's what's stored in `level.tiles` and what `getTileType()` looks up. The symbol is purely a convenience for authoring map text files.

Multiple tile types can share a symbol. For example, you might have `wall-h`, `wall-v`, `wall-corner-nw`, etc., all displaying `#` but with different sprites. The map legend maps each character to a specific tile ID, so distinct characters place distinct tile variants even when they all look the same in a plain-text view.

## Add a new tile type

1. Add an entry to [`data/tiles/terrain.js`](../../data/tiles/terrain.js):
   ```js
   door: { name: 'Door', symbol: '+', color: '#a08060', passable: true, opaque: true, sprite: { col: 3, row: 2 } },
   ```
2. Reference the new ID in a map legend (see [static-map-layouts.md](static-map-layouts.md)):
   ```js
   export const legend = { '.': 'floor', '#': 'wall', '+': 'door' };
   ```

No registration step is needed — `getTileType()` reads the export directly.

## Worth knowing

- **Tile IDs are stable identifiers.** Save files and map files reference them by ID. Renaming a tile ID without a migration will break existing saves and maps.
- **`color` is always required.** It's the renderer's fallback when the sprite sheet hasn't loaded yet, or when a tile has no `sprite` field. Don't leave it out.
- **`opaque` isn't used yet, but set it intentionally.** It will drive the FOV system. Getting it right now avoids a retroactive audit when FOV is added.
