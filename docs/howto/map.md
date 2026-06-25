# Map

*Index for everything map-related. "Map" spans three layers — authoring fixed layouts, generating a floor procedurally, and wiring floors into a dungeon. This page just points you at the right one.*

## The three layers

1. **[Static map layouts](static-map-layouts.md)** — authoring a hand-made floor: the tile array, overrides, and placed entities in a `data/maps/` file. Start here for a fixed, designed level.

2. **[Dynamic map generation](dynamic-map-generation.md)** — building a floor procedurally from a pipeline of stages (geometry → label → link → carve → populate). Covers the stage contract and how to add a stage or a pipeline.

3. **[Dungeon layout](dungeon-layout.md)** — wiring floors together: the transit map (which floors exist, how stairs connect), the pipeline registry, and the runtime that freezes/thaws floors as the player travels.

A single floor is produced by layer 1 or 2; layer 3 stitches floors into the playable dungeon.

## Supporting topics

- **[Tile types](tile-types.md)** — the tiles every layout and stage writes (passability, opacity, sprites).
- **[Visualizing generation](visualizing-generation.md)** — watch a pipeline build a floor stage by stage.

## Design background

- [map-generation.md](../design/map-generation.md) — the generation architecture and the model-(b) floor lifecycle.
- [procedural-3x3-dungeon.md](../design/procedural-3x3-dungeon.md) — the design of the shipped procedural pipeline.
- [dungeon-planner.md](../design/dungeon-planner.md) — the fuller transit-map model (ports, branching, validation) reserved for later.
