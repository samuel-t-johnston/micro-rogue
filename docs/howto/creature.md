# Creatures

*What a creature is in engine terms, and how to add a new one. (Also reachable as [monster.md](monster.md).)*

## How it works

A creature is not a class — it's an **entity built from a recipe of components** ([component.md](component.md)). The factories live in [`src/world/entities/creatures.js`](../../src/world/entities/creatures.js) (`createGoblin`, `createOrc`). The standard active-NPC recipe:

| Component | Role |
|---|---|
| `name` | display name |
| `entityTypeId` | stable prefab id (e.g. `'orc'`) — a content identity independent of `name`, stamped by the factory; loadout/loot rules filter on it ([loadouts.md](loadouts.md)) |
| `position` | location on the level |
| `health` | current / max HP |
| `attacker` | base (unarmed) attack damage |
| `faction` | hostility tags — see [`factions.js`](../../src/combat/factions.js) |
| `creature` | marks it as an actor (a living thing with agency) — the source of the `isActor` sense tag goals use to tell creatures from inert scenery and floor items |
| `turnTaker` | puts it in the turn queue at a given speed ([turn-order.md](turn-order.md)) |
| `blocksMovement` | occupies its tile |
| `inventory` + `wearsEquipment` | can carry and wear items ([item.md](item.md), [equipment.md](equipment.md)); a creature with these can be given a loadout and equip it via the `equip-weapon`/`equip-ammo` goals ([loadouts.md](loadouts.md)) |
| `memory` | per-entity scratch store for goals |
| `senses` + `tilePerception` | perception ([ai-senses.md](ai-senses.md)) |
| `ai` | the ordered goal stack that drives behaviour ([ai-goals.md](ai-goals.md)) |
| `renderable` | sprite / glyph |

Optional perception/communication add-ons (the orcs and the scuttler use these; see `createOrc`/`createOrcCommander`/`createScuttler`):

| Component | Role |
|---|---|
| `vision` | sight acuity (range); pairs with the `vision` sense. Omit for unlimited sight |
| `hearing` | hearing acuity (range); pairs with the `hearing` sense ([ai-senses.md](ai-senses.md)) |
| `smell` | smell acuity (a detection threshold); pairs with the `smell` sense |
| `knownLanguages` | which vocalization languages this creature understands when it hears them |
| `voice` | the language this creature shouts in — required to use the `shout` action |
| `scentSource` | lays a scent trail others can track ([scent-and-smell.md](../design/scent-and-smell.md)) |
| `noisyMovement` | sometimes emits a sound when moving (vermin scrabble, clanking armor) |

The **goal stack is where behaviour lives.** A goblin and an orc share the same component set; the goblin *flees* and the orc *chases* (and arms itself) purely because their `ai` lists differ:

```js
ai: ['attack-in-range', 'flee-from-others', 'wander-aimlessly']                 // goblin
ai: ['equip-weapon', 'attack-in-range', 'chase-others', 'wander-aimlessly']     // orc (abbreviated)
```

`attack-in-range` is the single combat goal for melee *and* ranged — it reads the creature's own weapon reach (`selfState.attackCapability`) and attacks the nearest hostile within it (a clear line is required beyond melee), so a dagger-wielder strikes only when adjacent while a bow-wielder fires across the room. The `equip-weapon`/`equip-ammo` goals sit above it: a creature given a loadout ([loadouts.md](loadouts.md)) wields it before engaging.

## Add a new creature

### 1. Add a factory

Add `createX(registry, x, y)` to [`src/world/entities/creatures.js`](../../src/world/entities/creatures.js), following the recipe. The interesting choices are:

- **Goal stack** (`ai`) — its behaviour and priorities.
- **`faction`** — who it's hostile to.
- **`senses`** — how it perceives.
- **Stats** — `health`, `attacker`, `turnTaker` speed.
- **`renderable`** — glyph + colour (creatures are glyph-only for now; no sprites yet).

### 2. Register it as a prefab

Add an entry to [`src/world/entities/entity-prefabs.js`](../../src/world/entities/entity-prefabs.js) keyed by a stable id, e.g. `kobold: { kind: 'creature', make: createKobold }`. That catalog is the single source of truth for spawnable types — static maps and `stage-populate` place creatures by this id — and [`entity-prefabs.test.js`](../../src/world/entities/entity-prefabs.test.js) fails if a `create*` factory is left unregistered.

### 3. Place it on the level

Call the factory and `level.placeEntity(...)`. This happens in a generation stage — procedurally in [`stage-populate.js`](../../src/world/generation/stages/stage-populate.js), or from a static layout's authored entities via [`stage-place-static-entities.js`](../../src/world/generation/stages/stage-place-static-entities.js). Having a `turnTaker` is what gets it into the turn queue automatically.

### 4. (Optional) give it a loadout

To have a creature spawn carrying gear, add a rule to the loadout stage rather than putting items in the factory — that keeps "what creatures exist" separate from "what they carry." See [loadouts.md](loadouts.md).

## Worth knowing

- **The player is the same recipe.** [`createPlayer`](../../src/world/entities/player.js) uses the identical component set plus `playerControlled` and a player goal stack. There is no separate "player vs monster" code path — they differ only in components.
- **Behaviour = goal stack order.** To make a creature braver, smarter, or cowardly, reorder or swap its goals; you rarely need new code.
- **Hostility is faction-derived.** Two entities are friendly if they share a faction tag; a factionless entity reads as hostile to everyone (see [`factions.js`](../../src/combat/factions.js)).
- **"Monster" is just a synonym.** The codebase says *creature* (the file is `creatures.js`); there's no `monster` concept in code.
- **`creature` vs `turnTaker` are deliberately separate.** `turnTaker` is about *action order* (anything that needs a turn — including future non-creature timed objects — can have one); `creature` is about *identity* (this is a living actor). Senses derive `isActor` from `creature` alone, so a non-creature that takes turns is never mistaken for a target.
