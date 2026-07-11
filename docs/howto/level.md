# Level

You may be looking for a concept relating to maps, in which case you'll want one of:

1. **[Static map layouts](static-map-layouts.md)** — authoring a hand-made floor: the tile array, overrides, and placed entities in a `data/maps/` file. Start here for a fixed, designed level.

2. **[Dynamic map generation](dynamic-map-generation.md)** — building a floor procedurally from a pipeline of stages (geometry → label → link → carve → populate). Covers the stage contract and how to add a stage or a pipeline.

3. **[Dungeon layout](dungeon-layout.md)** — wiring floors together: the transit map (which floors exist, how stairs connect), the pipeline registry, and the runtime that freezes/thaws floors as the player travels.

Alternately, you may be searching for XP and "leveling-up," and you should start at [tuning-level-up-growth.md](tuning-level-up-growth.md).