
data/                        # Pure JSON/JS data files, no logic
    ├── tiles/
    │   ├── terrain.js           # Tile type definitions: passable, opaque, enterEffect, etc.
    │   └── furniture.js         # Doors, chests, altars — static entity templates
    ├── entities/
    │   ├── creatures.js         # Enemy definitions: stats, AI goal stack, senses, drops
    │   └── player.js            # Starting player entity definition
    ├── items/
    │   ├── weapons.js
    │   ├── armor.js
    │   ├── consumables.js
    │   └── scrolls.js           # Identification game candidates
    ├── maps/
    │   └── floor-1-a.js         # Static layout: tile array + entity spawn hints
    └── pipelines/
        └── dungeon.js           # Pipeline config: which stages, which parameters