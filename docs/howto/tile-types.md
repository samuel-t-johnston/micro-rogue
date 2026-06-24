# Tile Types

*How tiles are defined and how to add new ones.*

Tile types live in [`data/tiles/terrain.js`](../../data/tiles/terrain.js) as a plain object keyed by tile ID. Each entry describes a single kind of terrain: its display properties (sprite art plus an ASCII glyph), movement rules, and line-of-sight.

## Fields

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Human-readable name (used in UI labels and the debug overlay) |
| `symbol` | string | Single character used by generation and map-visualization tooling (text maps) |
| `glyph` | string | Character drawn in glyph (ASCII) render mode, and as the fallback when the sprite can't be drawn |
| `glyphColor` | CSS color string | Color of the `glyph`. Must differ from `color`, or the glyph is invisible against its own cell |
| `color` | CSS color string | Cell fill painted behind the glyph in glyph mode and the sprite-unavailable fallback |
| `blocksMovement` | boolean | Whether the tile blocks entity movement (`true` = impassable) |
| `opaque` | boolean | Whether the tile blocks line of sight (drives the vision/FOV system) |
| `sprite` | string | Catalog sprite name — a key into [`data/sprites/sprite-catalog.js`](../../data/sprites/sprite-catalog.js), resolved to a sheet + grid cell (see [sprite-sheets.md](sprite-sheets.md)) |

The renderer draws the `sprite` in sprite mode; in glyph mode (or when the named sprite is missing or its sheet hasn't loaded) it fills the cell with `color` and draws `glyph` in `glyphColor` over it. So every tile needs **both** a resolvable sprite and a glyph — see the test note below.

## Symbol vs. tile ID

The tile ID is the registry key — it's what's stored in `level.tiles` and what `getTileType()` looks up. The symbol is purely a convenience for authoring and visualizing map text files.

Multiple tile types can share a symbol. For example, you might have `wall-h`, `wall-v`, `wall-corner-nw`, etc., all displaying `#` but with different sprites. The map legend maps each character to a specific tile ID, so distinct characters place distinct tile variants even when they all look the same in a plain-text view.

## Add a new tile type

1. Make sure the sprite exists in [`data/sprites/sprite-catalog.js`](../../data/sprites/sprite-catalog.js) (add it if not — see [sprite-sheets.md](sprite-sheets.md)).
2. Add an entry to [`data/tiles/terrain.js`](../../data/tiles/terrain.js):
   ```js
   door: {
     name: 'Door',
     symbol: '+',
     glyph: '+',
     glyphColor: '#a08060',
     color: '#5a4a36',
     blocksMovement: false,
     opaque: true,
     sprite: 'door-closed',
   },
   ```
3. Reference the new ID in a map legend (see [static-map-layouts.md](static-map-layouts.md)):
   ```js
   export const legend = { '.': 'floor', '#': 'wall', '+': 'door' };
   ```

No registration step is needed — `getTileType()` reads the export directly.

## Worth knowing

- **Tile IDs are stable identifiers.** Save files and map files reference them by ID. Renaming a tile ID without a migration will break existing saves and maps.
- **Every tile needs a glyph and a resolvable sprite.** `entity-sprites.test.js` enumerates all terrain (and entities) and asserts each has a truthy `glyph`, a `sprite` that resolves in the catalog, and a `glyphColor` distinct from its `color`. A new tile missing any of these fails the suite.
- **`sprite` is a name, not coordinates.** It's a key into the sprite catalog, which owns the sheet + cell mapping. Tiles never reference raw sheet coordinates.
- **`opaque` drives vision.** A tile blocks line of sight if its type is `opaque` (or it holds an `opaque` entity). Set it intentionally — it's live in the FOV system, not speculative.
- **`blocksMovement`, not `passable`.** The field is the impassable sense: `true` blocks movement. Entities also carry a `blocksMovement` component for the same effect.
