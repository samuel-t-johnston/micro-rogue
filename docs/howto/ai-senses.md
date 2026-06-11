# AI Senses

*How entities perceive the world, and how to add a new sense. (The sense system is deliberately minimal so far — see the limits below.)*

For the intended full design (hearing, smell, darkvision, confidence-weighted merging), see [ai-architecture.md](../design/ai-architecture.md). This doc covers what exists today.

## How it works

An entity's `senses` component is an ordered list of string keys, resolved through [`src/ai/senses/sense-registry.js`](../../src/ai/senses/sense-registry.js). Each sense is a function:

```js
sense(entity, level, turnCount) → SenseResult
```

A `SenseResult` is `{ entities, visibleTiles }`, where each observed entity carries `{ entityId, position, confidence, turnObserved, factions, tags }` and `tags` includes `isActor` / `isPlayer`.

[`planning-context.js`](../../src/ai/planning-context.js) runs every sense each turn, merges the results (highest confidence wins on conflict), updates the entity's `tilePerception`, and exposes the merged view as `context.perception` to goals ([ai-goals.md](ai-goals.md)). **Planners never read the world directly — only what senses report.**

Two senses exist:

| Sense | Source | Behaviour |
|---|---|---|
| `vision` | [`vision.js`](../../src/ai/senses/vision.js) | Shadowcasting FOV; a tile blocks sight if its type is `opaque` or it holds an `opaque` entity. Full detail on what's seen. |
| `mega-vision` | [`mega-vision.js`](../../src/ai/senses/mega-vision.js) | The complete world state — every positioned entity, no FOV or light gating. For the player and early AI work. |

### Current limits

- Only `vision` and `mega-vision` are implemented. Hearing, smell, and darkvision are designed but not built.
- `confidence` is always `100`; the confidence-weighted reasoning the merge supports isn't exercised yet.
- `vision` gates on tile **opacity** only — there is no light-level check yet.
- **Tile data is a known deviation:** pathfinding reads `context.level` directly rather than a sense-filtered "known map" (tracked in ADR-021).

## Add a new sense

1. Write the function (or a factory returning one) in `src/ai/senses/`, returning a `SenseResult` in the shape above.
2. Register it in the map in [`src/ai/senses/sense-registry.js`](../../src/ai/senses/sense-registry.js). (`registerSense(name, fn)` also exists, used for test doubles.)
3. Add the name to an entity's `senses` component (see [creature.md](creature.md)).

## Worth knowing

- **Senses are the abstraction boundary.** Blinding, deafening, or confusing a creature is just disabling or corrupting a sense — no special-casing in goals.
- **`isActor` vs `isPlayer` tags** let goals distinguish creatures from inert scenery/items (an actor has a `turnTaker`); hostility itself is decided from `factions` via `areHostile` (see [`factions.js`](../../src/combat/factions.js)).
- **Shape stability matters.** New senses must return the same `SenseResult` shape so the merge and goals need no changes.
