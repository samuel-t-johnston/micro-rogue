# Map Layouts

*How static map files are structured and how to create a new one.*

A static map is a JavaScript file in [`data/maps/`](../../data/maps/) that exports a tile string, a legend, and (optionally) a list of entities. The pipeline stage [`stage-static`](../../src/world/generation/stages/stage-static.js) loads one named layout; [`stage-random-static`](../../src/world/generation/stages/stage-random-static.js) seeds a choice among several. Either way the layout's tiles populate the level and its entities are placed by [`stage-place-static-entities`](../../src/world/generation/stages/stage-place-static-entities.js).

## File structure

```js
export const legend = {
  '.': 'floor',
  '#': 'wall',
};

export const tiles = `\
############
#..........#
#..........#
############`;

export const entities = [
  { type: 'stairsUp', x: 6, y: 2 },                          // doubles as the player's entry point
  { type: 'stairsDown', x: 1, y: 1 },
  { type: 'orc', x: 3, y: 1 },
  { type: 'healingPotion', x: 9, y: 2 },
  { type: 'chest', x: 10, y: 1, contents: ['dagger', 'scroll'] },
];
```

`legend` maps each character in the tile string to a tile ID (see [tile-types.md](tile-types.md)). `tiles` is a template literal. The leading `\` after the opening backtick prevents an extra blank first row.

Every row must be the same length, and every character must have an entry in `legend` — the loader throws a descriptive error if either condition fails.

## Entities

`entities` is an optional array of authored, exact-position placements. Tiles stay pure terrain (`.`/`#`); entities ride on top. Each entry is `{ type, x, y }`:

- **`stairsUp`** — also gets an `entryPoint`, so the player arrives here. **`stairsDown`** — a level exit (its `transition` destination is wired later by a coordinator).
- **Creatures** — `orc`, `goblin`. **Items** — `healingPotion`, `potionOfPain`, `dagger`, `sword`, `leatherArmor`, `scroll`.
- **Furniture** — `boulder`, `door`, and `chest`. A `chest` carries a `contents` array of item type names that are created inside it.

Placement is exact and deterministic (no RNG): the stage places exactly what the layout lists, where it lists it. Keep entity tiles on floor and avoid overlaps unless you intend a stack. Unknown types throw. The supported `type` ids are the keys of the prefab catalog in [`src/world/entities/entity-prefabs.js`](../../src/world/entities/entity-prefabs.js) — register a new entity type there to make it placeable.

## Regions: authored rooms and labels

By default a static layout publishes *no* rooms, so the shared population tail (`label`, `stairs`,
`spawn`, `populate`) has nothing to act on — a static level's contents come entirely from its authored
`entities`. Add an optional `regions` export to hand-designate rooms so those stages work over your
layout, letting a static area be *populated* like a generated one instead of hand-placing everything.

```js
export const regions = {
  // One legend maps a glyph to what that room is. `label` (or `labels`) attaches role labels the tail
  // reads ('stairs-up', 'stairs-down', 'treasure', 'item', 'amulet'); `kind` is optional (default
  // 'chamber' — a room that takes labels/population; 'passage' for connective tissue).
  legend: {
    S: { label: 'stairs-up' },
    T: { label: 'treasure' },
    V: { labels: ['item'] },
  },
  // Shape by *painting* — a grid the same size as `tiles`, its glyphs marking room membership. Any
  // char not in the region legend (here `.`) is filler, so paint your rooms over a copy of the map.
  // A painted glyph becomes an irregular tile-set room, so rooms can be any shape.
  paint: `\
..............
..SSSS..TTTT..
..SSSS..TTTT..
..............`,
  // …or by *rect* — each entry tags a rectangle with a glyph. A single rect stays a rectangular room.
  rects: [{ glyph: 'V', x0: 2, y0: 4, x1: 6, y1: 6 }],
};
```

Rooms are **partial**: only the tiles you tag become rooms; untagged floor is left unregioned, so you
can hand-author some rooms and leave the rest of a floor to `populate`. A room's tiles must be floor —
population places into them without re-checking passability. Pair the layout with the tail stages in
the pipeline (and skip `placeStaticEntities` for anything you'd rather have `populate` roll):

```js
{ type: 'static', layout: 'my-vault' },
{ type: 'label', labels: ['stairs-down'], fill: 'item' }, // optional: auto-label the untagged rooms
{ type: 'stairs' },
{ type: 'spawn' },
{ type: 'populate', creatures: [/* … */] },
```

## Embedding a static block: `bounds` and `section`

A static stage can lay its layout into an *already-generated* level instead of owning the whole grid,
so a hand-authored area composes with procedural ones (see
[dynamic-map-generation.md](dynamic-map-generation.md) and the composition section of
[organic-map-generation.md](../design/organic-map-generation.md)).

- **`bounds: {x,y,w,h}`** — stamp the layout at `(x,y)` of an in-progress level (built by an earlier
  `box` or structure stage) rather than sizing a fresh grid. The layout must fit within `w×h` (it
  throws otherwise); tiles, authored entities, and authored regions are all offset by `(x,y)`.
- **`section: id`** — stamp a district id on the layout's authored zones, so `label`/`populate` can be
  scoped to it (run those stages once per section). Same mechanism the composite floor uses for its
  BSP-vs-cave districts.

```js
{ type: 'box', width: 44, height: 24 },
{ type: 'static', layout: 'keep', bounds: { x: 0, y: 0, w: 16, h: 24 }, section: 'keep' },
{ type: 'caSeed', bounds: { x: 16, y: 0, w: 28, h: 24 } }, // … CA cave fills the rest
```

Multiple static stages accumulate: each appends its entities and its zones (ids offset so they don't
collide), so several authored blocks can share one floor.

## Connecting an embedded block: connectors

An embedded block's footprint is **protected** — `stitch` will never carve into it — so by default an
embedded block reads as its own sealed area. To let the floor connect to it, author one or more
**connectors**: floor tiles (openings you've cut in the block's own wall) that stitch is allowed to
join the block through. A connector is a `regions` glyph with `{ connector: true }`:

```js
export const tiles = `\
##############
#............#
#............#
#.............   ← the wall is opened here (a floor tile) …
##############`;

export const regions = {
  legend: { '>': { connector: true } }, // … and marked as the connector
  paint: `\
..............
..............
..............
.............>
..............`,
};
```

Then run `stitch` after the generated sections. It routes a corridor from the exterior up to the
connector and **drops no door** (the block owns its own opening/door treatment) — the block's interior
is never touched. The connector may sit on any face: stitch carves a straight/L corridor when it can,
and routes *around* the footprint (any number of segments) when the connector faces away from what it's
reaching. A connector must sit on a floor tile (it throws otherwise). A block with no connectors stays
sealed, which is a fine choice for a hidden vault; a connector that's genuinely boxed in with no route
out is warned about instead.

> **Digger/passage areas** (raw CA/walker corridors with no chamber zone) aren't connectable this way
> yet — connectors are currently authored by static layouts. Publishing them from a digger stage is a
> planned follow-up; the `stitch` machinery already supports it.

## Create a new map

1. Create a file in [`data/maps/`](../../data/maps/), e.g. `my-map.js`.
2. Define `legend` and `tiles` as above.
3. Keep all rows the same length.
4. Cover every character you use in `legend`.

## Wire it to a pipeline

Create a pipeline descriptor in [`data/pipelines/`](../../data/pipelines/). Pair a structure stage with `placeStaticEntities`:

```js
// One fixed layout.
export default {
  id: 'my-pipeline',
  stages: [
    { type: 'static', layout: 'my-map' },
    { type: 'placeStaticEntities' },
  ],
};
```

```js
// Seeded choice among several layouts ("static choice").
export default {
  id: 'my-maze',
  stages: [
    { type: 'randomStatic', layouts: ['maze-spiral', 'maze-zigzag', 'maze-pillars'] },
    { type: 'placeStaticEntities' },
  ],
};
```

`layout` (or each entry in `layouts`) is the filename without `.js`. `randomStatic` picks one via the generation RNG, so the same seed always yields the same layout. Import and pass the descriptor to `runPipeline()` in your game scene. If a layout has no `entities`, `placeStaticEntities` is a harmless no-op.

## Worth knowing

- **The loader trims the tile string before splitting into rows.** Leading and trailing blank lines at the string level are removed; blank lines in the middle of the map would produce zero-width rows and fail the row-length check.
- **Map files are dynamically imported at runtime.** The stage resolves paths relative to `import.meta.url`, which is required for GitHub Pages compatibility.
- **The `legend` and `tiles` exports must both be named exports** (not default). The stage reads them as `mod.legend` and `mod.tiles`.
