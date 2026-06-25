# Vision

*How sight works: shadowcasting FOV, what blocks it, and how seen tiles become fog-of-war memory. The deep-dive companion to [ai-senses.md](ai-senses.md), which covers all senses at a glance.*

Vision is the sense the player and every NPC actually use to find each other. Like all senses it never reads the world for the planner directly — it produces a `SenseResult` that [`planning-context.js`](../../src/ai/core/planning-context.js) merges into `context.perception`.

## How it works

The [`vision` sense](../../src/ai/senses/vision.js) runs **symmetric shadowcasting** ([`computeFov`](../../src/engine/core/fov.js), Albert Ford's algorithm) from the entity's tile and returns:

- **`visibleTiles`** — a `Set` of `"x,y"` tile keys (built via [`tileKey`](../../src/engine/core/tile-key.js)) that are currently in line of sight, always including the origin.
- **`entities`** — every positioned entity standing on a visible tile, reported at `confidence: 100` with full detail (`position`, `factions`, `tags.isActor`/`isPlayer`).

### What blocks sight

A tile is opaque — and stops the cast — if **either**:

- its tile type is `opaque` (walls; see [tile-types.md](tile-types.md)), **or**
- a positioned entity on it has the `opaque` component (a closed door; an open one isn't opaque).

Out-of-bounds tiles read as opaque, so the cast stops at the map edge.

### Range (acuity)

The optional **`vision(range)`** component ([`components.js`](../../src/world/entities/components.js)) sets the FOV radius:

- **No component / `range: undefined`** → unlimited sight. This is the player and most creatures.
- **A finite range** → a myopic creature that must lean on other senses to track what it can't see. The scuttler (`vision(3)`, in [`creatures.js`](../../src/world/entities/creatures.js)) is the example — short-sighted but it hunts by [smell](smell.md).

## From sight to fog of war

`planning-context.js` folds each turn's `visibleTiles` into the entity's **`tilePerception`** component, which holds three things:

| Field | Meaning |
|---|---|
| `visible` | tiles seen *this* turn (recomputed every turn) |
| `memory` | every tile id ever seen — the explored map, drawn dimmed when out of sight |
| `rememberedEntities` | last-seen appearance of `persistVisible` furniture (doors, chests, stairs) on seen tiles |

This is what produces the three-tier fog of war: **visible** (full truth) → **remembered** (dimmed terrain + furniture at its last-seen state) → **unseen** (dark). Live actors are never remembered — they don't ghost — only `persistVisible` furniture does. The renderer ([`renderer.js`](../../src/render/renderer.js)) reads these sets to dim or hide tiles, and [`describe-tile.js`](../../src/world/map/describe-tile.js) tiers the "look at" sentence the same way.

## Tweak it

- **Myopia:** add `vision(n)` to a creature; pair it with `hearing`/`smell` so it isn't helpless.
- **Blindness / blinding:** vision is just a sense, so removing `'vision'` from the `senses` list blinds an entity with no special-casing in goals — the abstraction boundary doing its job.
- **A new sight-blocker:** mark a tile type `opaque`, or give a furniture entity the `opaque` component (mirroring closed doors).

## Known limits

- `vision` gates on **opacity only** — there is no light-level check yet; darkvision is designed but unbuilt (see [ai-architecture.md](../design/ai-architecture.md)).
- `confidence` is always `100`; the confidence-weighted merge isn't exercised by vision.
- Pathfinding reads `context.level` directly rather than a sight-filtered known map (ADR-021).

## See also

- [AI senses](ai-senses.md) — the `SenseResult` contract and the other senses.
- [Sound](sound.md) / [Smell](smell.md) — the senses a myopic creature falls back on.
