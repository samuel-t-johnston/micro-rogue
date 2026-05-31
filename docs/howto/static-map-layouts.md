# Map Layouts

*How static map files are structured and how to create a new one.*

A static map is a JavaScript file in [`data/maps/`](../../data/maps/) that exports a tile string and a legend. The pipeline stage [`stage-static`](../../src/world/generation/stages/stage-static.js) loads it and populates a level from it.

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
```

`legend` maps each character in the tile string to a tile ID (see [tile-types.md](tile-types.md)). `tiles` is a template literal. The leading `\` after the opening backtick prevents an extra blank first row.

Every row must be the same length, and every character must have an entry in `legend` — the loader throws a descriptive error if either condition fails.

## Create a new map

1. Create a file in [`data/maps/`](../../data/maps/), e.g. `my-map.js`.
2. Define `legend` and `tiles` as above.
3. Keep all rows the same length.
4. Cover every character you use in `legend`.

## Wire it to a pipeline

Create a pipeline descriptor in [`data/pipelines/`](../../data/pipelines/):

```js
export default {
  id: 'my-pipeline',
  stages: [{ type: 'static', layout: 'my-map' }],
};
```

The `layout` value is the filename without `.js`. Import and pass this descriptor to `runPipeline()` in your game scene.

## Worth knowing

- **The loader trims the tile string before splitting into rows.** Leading and trailing blank lines at the string level are removed; blank lines in the middle of the map would produce zero-width rows and fail the row-length check.
- **Map files are dynamically imported at runtime.** The stage resolves paths relative to `import.meta.url`, which is required for GitHub Pages compatibility (see AGENTS.md).
- **The `legend` and `tiles` exports must both be named exports** (not default). The stage reads them as `mod.legend` and `mod.tiles`.
