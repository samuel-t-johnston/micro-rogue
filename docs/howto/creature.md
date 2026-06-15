# Creatures

*What a creature is in engine terms, and how to add a new one. (Also reachable as [monster.md](monster.md).)*

## How it works

A creature is not a class — it's an **entity built from a recipe of components** ([component.md](component.md)). The factories live in [`src/world/creatures.js`](../../src/world/creatures.js) (`createGoblin`, `createOrc`). The standard active-NPC recipe:

| Component | Role |
|---|---|
| `name` | display name |
| `position` | location on the level |
| `health` | current / max HP |
| `attacker` | base (unarmed) attack damage |
| `faction` | hostility tags — see [`factions.js`](../../src/combat/factions.js) |
| `turnTaker` | puts it in the turn queue at a given speed ([turn-order.md](turn-order.md)) |
| `blocksMovement` | occupies its tile |
| `inventory` + `wearsEquipment` | can carry and wear items ([item.md](item.md), [equipment.md](equipment.md)) |
| `memory` | per-entity scratch store for goals |
| `senses` + `tilePerception` | perception ([ai-senses.md](ai-senses.md)) |
| `ai` | the ordered goal stack that drives behaviour ([ai-goals.md](ai-goals.md)) |
| `renderable` | sprite / glyph |

The **goal stack is where behaviour lives.** A goblin and an orc share the same component set; the goblin *flees* and the orc *chases* purely because their `ai` lists differ:

```js
ai: ['attack-adjacent', 'flee-from-others', 'wander-aimlessly']  // goblin
ai: ['attack-adjacent', 'chase-others',     'wander-aimlessly']  // orc
```

## Add a new creature

### 1. Add a factory

Add `createX(registry, x, y)` to [`src/world/creatures.js`](../../src/world/creatures.js), following the recipe. The interesting choices are:

- **Goal stack** (`ai`) — its behaviour and priorities.
- **`faction`** — who it's hostile to.
- **`senses`** — how it perceives.
- **Stats** — `health`, `attacker`, `turnTaker` speed.
- **`renderable`** — glyph + colour (creatures are glyph-only for now; no sprites yet).

### 2. Place it on the level

Call the factory and `level.placeEntity(...)`. This happens in a generation stage — procedurally in [`stage-populate.js`](../../src/world/generation/stages/stage-populate.js), or from a static layout's authored entities via [`stage-place-static-entities.js`](../../src/world/generation/stages/stage-place-static-entities.js). Having a `turnTaker` is what gets it into the turn queue automatically.

## Worth knowing

- **The player is the same recipe.** [`createPlayer`](../../src/world/player.js) uses the identical component set plus `playerControlled` and a player goal stack. There is no separate "player vs monster" code path — they differ only in components.
- **Behaviour = goal stack order.** To make a creature braver, smarter, or cowardly, reorder or swap its goals; you rarely need new code.
- **Hostility is faction-derived.** Two entities are friendly if they share a faction tag; a factionless entity reads as hostile to everyone (see [`factions.js`](../../src/combat/factions.js)).
- **"Monster" is just a synonym.** The codebase says *creature* (the file is `creatures.js`); there's no `monster` concept in code.
