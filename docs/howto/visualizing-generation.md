# Visualizing Map Generation

*A headless dev tool for eyeballing what a generation pipeline produces — several example maps from a pipeline, rendered to a self-contained HTML page you can open or drop into a chat. For the design, see [procedural-3x3-dungeon.md](../design/procedural-3x3-dungeon.md).*

## Run it

```
npm run visualize -- [pipelineId] [seeds] [outPath]
```

- `pipelineId` — a pipeline in [`data/pipelines/`](../../data/pipelines/) (default `composite`). Anything with a default pipeline export: `bsp`, `ca`, `walker`, `composite`, …
- `seeds` — how many maps to generate; map *i* uses seed *i* (default 4)
- `outPath` — HTML output (default `mapgen-<pipelineId>.html`, gitignored)

Example: `npm run visualize -- ca 6` writes 6 cellular-automata caves (seeds 1–6) to `mapgen-ca.html`. Or run the script directly: `node scripts/visualize-generation.mjs ca 6`.

## What you get

A responsive grid of the resulting maps, one card per seed. Each map is rendered by [`levelToHtml`](../../src/world/generation/visualize.js):

- **Tiles** — walls dark, floor lighter. Rooms are tinted by their **district** (`section`) — up to eight cycled colours — so a composed floor's wings read apart at a glance; passages (organic connective tissue) get their own muted colour; corridors and stitches show as plain floor. A legend maps each swatch.
- **Entities** — drawn as their own game glyphs in their glyph colours (stairs `<`/`>`, doors `+`, creatures, items `*`), highest render layer winning a shared tile.

Determinism holds: the same `pipelineId` + seed always renders the same map, so any card reproduces.

## Reused by the dev page

The renderer is a pure, DOM-free function — `levelToHtml(level)` returns an HTML string — so the exact same code runs headless here (the CLI writes the file) and in the browser (the map-gen dev page injects the fragment). They share `MAP_STYLES` too, so the two tools can't drift.

## Change what's visualized

Pass a different `pipelineId`. To tweak a pipeline's stages or params, edit its descriptor in [`data/pipelines/`](../../data/pipelines/) — the stage registry and every stage's `DEFAULTS` live in [`pipeline.js`](../../src/world/generation/pipeline.js) and the stage files.

## Other renderers

[`visualize.js`](../../src/world/generation/visualize.js) also exports text renderers used by tests and quick debugging — `levelToAscii` (the tile grid as text), `zonesToText` (zones/links/adjacency), and `zonesToMermaid` (the planning graph as a Mermaid flowchart). All pure, all unit-tested, no DOM.

## How it works

The tool seeds the generation stream directly with `createRng(seed)`; in the running game that stream is instead derived as `rng.deriveRng('mapgen', branch, depth)` ([rng-and-determinism.md](../design/rng-and-determinism.md)). The pipeline runner ([`pipeline.js`](../../src/world/generation/pipeline.js)) also exposes an `onStageComplete(stageType, level)` hook — a seam a future stage-by-stage view can snapshot through.
