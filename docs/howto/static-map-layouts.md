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
