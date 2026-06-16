# Visualizing Map Generation

*A headless dev tool for inspecting what a generation pipeline produces — a markdown "filmstrip" of the level after each stage. For the design, see [procedural-3x3-dungeon.md](../design/procedural-3x3-dungeon.md).*

## Run it

```
npm run visualize -- [runs] [baseSeed] [outPath]
```

- `runs` — how many layouts to generate (default 1)
- `baseSeed` — first generation-stream seed; run *i* uses `baseSeed + i` (default 1)
- `outPath` — markdown output (default `generation-report.md`, gitignored)

Example: `npm run visualize -- 5 100` writes 5 layouts (seeds 100–104). Or run the script directly: `node scripts/visualize-generation.mjs 5 100`.

The report records the pipeline config, a timestamp, and the seeds, so any run reproduces. Each run is a **filmstrip**: a snapshot after every stage, showing the level evolve.

## What you get per stage

- **Topology** (text) — zones with their labels/cells/rect, the chosen `links`, and the raw `adjacency`.
- **Topology** (Mermaid) — a `flowchart` of the same: links solid, unlinked adjacency dashed. Topologically faithful, **not** spatially (Mermaid auto-lays-out nodes; it won't match the grid).
- **Map** (text/ASCII) — the tile grid via [`levelToAscii`](../../src/world/generation/visualize.js). Shows `(no tiles carved yet)` for planning-only pipelines; comes alive once a carve stage runs.

## Change what's visualized

Edit the `PIPELINE` constant in [`scripts/visualize-generation.mjs`](../../scripts/visualize-generation.mjs) — add/remove stages or pass stage params (e.g. `{ type: 'roomGridGeometry', cols: 4, rows: 4, deletes: 2 }`). You can visualize a single stage by listing just one.

## How it works

The pipeline ([`pipeline.js`](../../src/world/generation/pipeline.js)) takes an optional `onStageComplete(stageType, level)` hook; the tool uses it to capture a snapshot after each stage. Rendering is done by pure functions in [`visualize.js`](../../src/world/generation/visualize.js) (`levelToAscii`, `zonesToText`, `zonesToMermaid`) — unit-tested, no DOM. The tool seeds the generation stream directly with `createRng(seed)`; in the running game that stream is instead derived as `rng.deriveRng('mapgen', branch, depth)` ([rng-and-determinism.md](../design/rng-and-determinism.md)).
