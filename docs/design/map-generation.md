# Map Generation: Pipelines and Stages
Purpose: Initial map generation design overview for ROGµE.

## Core Principle: Generation is a Pipeline of Stages

Map generation is not a single algorithm — it's a sequence of discrete stages, each reading from and writing to shared data. This keeps concerns separated, makes the system extensible, and allows complex levels to emerge from simple composable parts.

**Current target: single-stage static layouts.** The pipeline architecture is designed to grow into, not to be fully built upfront. Start with one stage that loads a fixed layout; expand the pipeline iteratively as the game needs it.

> The first procedural pipeline — a Rogue-style 3×3 room dungeon — is planned and tracked in
> [procedural-3x3-dungeon.md](procedural-3x3-dungeon.md).

---

## Vocabulary

**Pipeline** — the full ordered sequence of stages that produces a level. Different level types run different pipelines, or the same pipeline with different stage configurations.

**Stage** — one step in the pipeline. A stage reads from the map data and blackboard, does its work, and writes results back. Stages run sequentially; each one sees the output of everything before it.

**Blackboard** — a shared annotation layer, separate from tile data and the entity layer. Stages write tags and metadata here; downstream stages read them. Loosely couples stages without requiring them to know about each other directly.

**Seed** — the value that initializes the RNG for one level's pipeline. It is *not* the game's master seed directly: it is **derived** from the master seed and the level's identity `(branch, depth)`, on its own stream, independent of gameplay RNG — see [rng-and-determinism.md](rng-and-determinism.md). The same master seed always produces the same level for a given `(branch, depth)`, including structure, entity placement, and item rolls. Enables daily maps, shareable layouts, and reproducible bug reports.

---

## What Stages Do

Stages tend to fall into families, though these are descriptive tendencies rather than strict rules. A stage that generates a special room intrinsically knows what it made — it should tag it directly rather than leaving classification to a later pass.

**Structure** — produces physical terrain: tiles, rooms, corridors, open areas. This is where the distinction between static and procedural layouts lives. A static structure stage loads a fixed layout; a procedural one runs an algorithm. Everything downstream is the same either way.

**Annotation** — reads existing structure and writes tags to the blackboard. Most useful for post-hoc classification (inferring room purpose from geometry), cross-cutting concerns (flood-risk zones that depend on both terrain and water sources), or late-binding decisions (designating a boss room only once the full level shape is known). Often unnecessary when a structure stage already knows what it made.

**Population** — places entities: creatures, items, furniture, traps. Reads tags and biome parameters to make placement decisions. Can run as multiple passes — enemy placement before trap placement, for example, so traps can be seeded near enemies intentionally.

**Finishing** — final detail before the level is handed to the game: lighting setup, patrol route seeding, ambient detail (rubble, stains), entrance and exit placement.

---

## The Blackboard as Communication

The blackboard is the primary way stages communicate without direct coupling. A structure stage writes `room:type=armory`; a population stage reads it and selects from a weapons loot table; a finishing stage reads it and adjusts lighting. None of these stages need to know about each other.

This mirrors the `squadState` pattern in the AI architecture — shared writable state that decouples producers from consumers. The same mental model appears at multiple scales in the game.

Tags can be scoped to tiles, regions, or the level as a whole:

```javascript
blackboard.set('room:42:type', 'armory')
blackboard.set('zone:flooded', [/* tile coords */])
blackboard.set('level:theme', 'sewers')
```

The exact shape is implementation detail. The principle is that stages speak in abstract tags; nothing downstream is hard-coded to a specific level's structure.

---

## Seeded Determinism

The seed covers the full pipeline: terrain shape, room contents, creature placement, item rolls, shop inventories. Partial seeding produces levels that feel inconsistent — if the layout is fixed but loot is random, sharing a seed means nothing.

The pipeline runs on a **per-level generation RNG**, obtained as `service.derive('mapgen', branch, depth)` ([rng-and-determinism.md](rng-and-determinism.md)) — a fresh stream whose seed is derived from the master seed and the level's identity, *separate from the gameplay stream*. Two consequences:

- **Play never changes generation.** Because generation draws from its own stream, fighting, looting, or wandering between floors can't shift what the next floor generates. This is what lets seeds mean the same thing across runs with different histories.
- **Levels generate lazily.** A level's seed is computed from `(branch, depth)`, not consumed in sequence, so any level can be generated on demand without generating the ones before it.

Within a level, each stage draws from that one generation RNG and advances it as it consumes values. Stage order must be stable for seeds to be reproducible — adding a stage or changing stage order breaks existing seeds, which is acceptable during development but worth a note when the game reaches players.

Player actions that mutate the map (digging, flooding via the tile override layer) diverge from the seed intentionally. The seed determines initial state; player choices produce the divergence from there. No conflict.

---

## Level Types as Pipeline Configurations

The different categories of level — static, procedural, hybrid, special — are not fundamentally different systems. They are different **configurations of the same pipeline**: primarily different structure stages, with annotation, population, and finishing stages largely reused across all of them.

| Level type | Structure stage | Notes |
|---|---|---|
| Static | Load fixed layout | Simplest case; good starting point |
| Static choice | Pick one fixed layout from a set | Selection can be seeded |
| Fully procedural | Run generation algorithm | BSP, cellular automata, etc. |
| Split region | Run multiple structure stages, stitch | Regions can mix static and procedural |
| Dynamic choice | Pick between procedural configurations | Same algorithm, different parameters |

A "dynamic choice" level (like Shattered Pixel Dungeon's troll basement) is just a thin selection wrapper around an otherwise normal procedural pipeline. The selection logic is not a special system.

---

## Level Lifecycle and Cold Storage

Only the current level runs. Other levels are serialized and stored when the player leaves, deserialized on return. What to preserve:

- Tile base data and override layer state
- All entity state, including stationary entity timers
- The blackboard (tags may be needed for re-entry logic)
- The derived generation seed used to build the level (allows reconstruction even if the derivation function later changes — see [rng-and-determinism.md](rng-and-determinism.md))

Enemies that follow the player through stairs are not serialized with the level — they travel with the player through the transition instead.

---

## Speculative: Re-entry Pipelines

*This idea is worth preserving but not designing in detail yet. Revisit once the generation pipeline is working and real re-entry scenarios exist to reason from.*

When the player returns to a stored level, it might be interesting to run a lightweight pipeline over the saved state rather than simply deserializing it as-is. Re-entry stages could simulate the passage of time (redistributing creatures, consuming perishable items), or reflect broader game state changes (all monsters enraged after a major story event).

The generation pipeline is an obvious conceptual model for this — both are sequences of passes that modify map state. The key difference is input: generation starts from a seed and parameters; re-entry starts from a fully-formed saved level and global game context. This might make a shared abstraction awkward in practice even if the vocabulary carries over.

The relationship could go a few ways: a fully separate re-entry pipeline modeled loosely on generation; generation stages that declare themselves re-runnable; or something simpler — event handlers that fire on level load, which may be sufficient for most re-entry effects without needing pipeline machinery at all. Don't resolve this until there are concrete scenarios to design against.

---

## What to Avoid

- Designing detailed procedural stages before the game is playable — validate the pipeline with static layouts first
- Treating level types as fundamentally different systems — they are pipeline configurations
- Annotating in a separate stage what a structure stage already knows
- Partial seeding — if the seed doesn't cover entity placement, sharing seeds is meaningless
- Changing stage order without noting that it breaks existing seeds