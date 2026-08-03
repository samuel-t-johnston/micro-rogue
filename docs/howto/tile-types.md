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
| `category` | string | The generation-facing role: `'floor'` or `'wall'`. Map generation reads and writes tiles by category, never by tile id, so a stone floor and a cave floor are interchangeable to a carve stage (see [Terrain palettes](#terrain-palettes)) |
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
     category: 'floor',
     sprite: 'door-closed',
   },
   ```
3. Reference the new ID in a map legend (see [static-map-layouts.md](static-map-layouts.md)):
   ```js
   export const legend = { '.': 'floor', '#': 'wall', '+': 'door' };
   ```

No registration step is needed — `getTileType()` reads the export directly.

## Terrain palettes

Map generation never writes a tile id like `'floor'` directly. Carve stages resolve a **palette** — a
`{ floor, wall }` pair of tile ids — and lay those down; readers (connectivity, cave smoothing,
segmentation) branch on a tile's `category`, not its id. That decoupling is what lets the same CA or BSP
stage produce stone one run and cave the next: only the palette changes.

The palette lives on the generation blackboard and is **sticky**. A pipeline sets it with the `palette`
stage, and it holds until the next `palette` stage — so you theme a run (or one section of a composed
level) by interleaving palette stages rather than passing tile ids to every carve stage:

```js
stages: [
  { type: 'palette', floor: 'cave-floor', wall: 'cave-wall' }, // everything below is now cave
  { type: 'caSeed', width: 56, height: 40 },
  { type: 'caSmooth' },
  { type: 'caBridge' },
  { type: 'segmentRegions' },
]
```

Both slots are optional and merge, so `{ type: 'palette', floor: 'floor' }` flips just the floor and
leaves the wall as-is. A slot's tile must have the matching `category` (a `floor` slot needs a
floor-category tile) or the stage throws. With no `palette` stage, generation falls back to plain stone
(`floor` / `wall`). See [`src/world/generation/palette.js`](../../src/world/generation/palette.js) and
[dynamic-map-generation.md](dynamic-map-generation.md).

**Static maps don't use palettes** — their legend names concrete tile ids directly (`{ ',': 'cave-floor' }`),
so author cave terrain straight into the legend (see [static-map-layouts.md](static-map-layouts.md)).

## Line walls

The base wall tiles (`wall`, `cave-wall`) each have a **line-wall family** — 15 generated variants that
differ from the base only in `glyph`, one per non-empty combination of cardinal neighbours, drawn with
CP437 double-line box characters (║ ╣ ╬ …). They live in
[`data/tiles/line-walls.js`](../../data/tiles/line-walls.js), not `terrain.js`, and are merged into the
registry by [`tile-registry.js`](../../src/world/map/tile-registry.js) so they resolve like any other
tile. Variant ids are `${base}-${dirs}` in N-E-S-W order (`wall-ns`, `wall-nes`, `cave-wall-nesw`).

They're placed by the `lineWalls` generation stage (see
[dynamic-map-generation.md § Line walls](dynamic-map-generation.md#line-walls-cp437-double-line-rendering)),
which analyses each wall's neighbours and swaps in the matching variant. Because a variant inherits its
base's `name`, `category`, `blocksMovement`, `opaque`, `symbol`, and `sprite` — overriding only the
glyph — it's cosmetic in glyph mode and a no-op in sprite mode (variants reuse the base sprite until
per-direction wall art exists). To give a new wall type a line family, add its id to
`LINE_WALL_FAMILIES`.

## Worth knowing

- **Tile IDs are stable identifiers.** Save files and map files reference them by ID. Renaming a tile ID without a migration will break existing saves and maps.
- **Every tile needs a glyph and a resolvable sprite.** `entity-sprites.test.js` enumerates all terrain (and entities) and asserts each has a truthy `glyph`, a `sprite` that resolves in the catalog, and a `glyphColor` distinct from its `color`. A new tile missing any of these fails the suite.
- **`sprite` is a name, not coordinates.** It's a key into the sprite catalog, which owns the sheet + cell mapping. Tiles never reference raw sheet coordinates.
- **`opaque` drives vision.** A tile blocks line of sight if its type is `opaque` (or it holds an `opaque` entity). Set it intentionally — it's live in the FOV system, not speculative.
- **`blocksMovement`, not `passable`.** The field is the impassable sense: `true` blocks movement. Entities also carry a `blocksMovement` component for the same effect.
- **`category` is what generation branches on, not the tile id.** Carve stages read floor-vs-wall via `isFloorTile()` (in [`tile-registry.js`](../../src/world/map/tile-registry.js)), which resolves the tile's `category` — never by comparing the id to `'floor'`/`'wall'`. A new floor/wall variant just needs the right `category` to slot into every generator. It's a small closed vocabulary (`'floor'`, `'wall'` today) with room to grow.
