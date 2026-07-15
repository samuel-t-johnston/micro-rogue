# Extension Points

*The intended fork surface: where you plug in new content and behaviour without editing engine internals, and how stable each seam is.*

ROGµE is built to be forked. The engine reads **content** (creatures, items, maps, flavor, win conditions) by structure, and exposes **registries** for new **behaviour** (senses, goals, attributes, effects, win/upkeep hooks). This page enumerates those seams. Anything not listed here is an internal — it may change without notice.

## Stability legend

| Marker | Meaning |
|---|---|
| **Stable** | A named `register*` function or `data/` file intended for external use. Signature/shape changes are treated as breaking. |
| **Add-to-map** | Extend by adding an entry to a literal registry map in engine code. Stable in spirit; you edit one well-marked map, not logic. |
| **API-present, UI-deferred** | A working, tested API with no shipped caller yet — safe to drive from a fork; see the roadmap for the planned first-party wiring. |

---

## Behaviour registries (Stable)

Each maps a **string name** (stored on a component or config, so it serializes cleanly) to an implementation. Register a new one at load time; entities/configs then reference it by name.

| Seam | Register with | Referenced by |
|---|---|---|
| **Sense** | `registerSense(name, sense)` — [`sense-registry.js`](../../src/ai/senses/sense-registry.js) | the `senses` component |
| **Goal** | `registerGoal(name, goal)` — [`goal-registry.js`](../../src/ai/goals/goal-registry.js) | the `ai` component (order = priority) |
| **Attribute** | `registerAttribute(definition)` — [`attribute-registry.js`](../../src/attributes/attribute-registry.js) | the `attributes` component; see [attributes.md](attributes.md) |
| **Win condition** | `winConditions.register(name, fn)` — [`win-conditions.js`](../../src/engine/turn/win-conditions.js) | evaluated at each player turn-end |
| **Upkeep hook** | `upkeep.register(name, fn)` — [`upkeep.js`](../../src/engine/turn/upkeep.js) | run once per round (e.g. scent deposit) |

Registering the same name again replaces the prior entry (handy for tests and overrides). Resolving an unregistered name throws.

## Add-to-map extension points

These don't (yet) have a runtime `register*` function — you add an entry to a literal map in engine code. Each map is a single, documented "add here" site.

| Seam | Map | File |
|---|---|---|
| **Effect** | `EFFECTS` | [`effects.js`](../../src/effects/core/effects.js) — a `consumable`/`throwable` `effectType` resolves here |
| **Generation stage** | `STAGES` | [`pipeline.js`](../../src/world/generation/pipeline.js) — a pipeline config's `{ type }` resolves here |
| **Component** | `components` | [`components.js`](../../src/world/entities/components.js) — **and** see the serialization rule below |
| **Entity prefab** | `ENTITY_PREFABS` | [`entity-prefabs.js`](../../src/world/entities/entity-prefabs.js) — the spawnable-type catalog |

> **Component serialization rule.** A component's data must be plain JSON so it survives save + load. If it holds an entity ref, a `Set`/`Map`, a class instance, or a non-finite number, register a codec in [`serialize.js`](../../src/save/core/serialize.js). The round-trip guard in `serialize.test.js` fails loudly for any component that doesn't survive save/load — so a new non-plain component with no codec is caught at test time, not at a player's save.

## Content in `data/` (Stable)

Shipped content lives in [`data/`](../../data), read by structure — the engine imports it but never hardcodes it. Fork a file to change the game's content without touching engine code.

| File(s) | Drives |
|---|---|
| [`data/pipelines/*.js`](../../data/pipelines) | Map-generation recipes: the ordered stage list + each stage's config (incl. the creature roster) |
| [`data/maps/*.js`](../../data/maps) | Hand-authored static layouts (`tiles` + `legend` + authored entities) |
| [`data/tiles/terrain.js`](../../data/tiles/terrain.js) | Tile types (passability, opacity, sprite/glyph) |
| [`data/sprites/sprite-catalog.js`](../../data/sprites/sprite-catalog.js) | Named sprite → sheet/cell mapping |
| [`data/senses/scent-flavor.js`](../../data/senses/scent-flavor.js), [`language-flavor.js`](../../data/senses/language-flavor.js) | Smell/sound log flavor (and which are noteworthy enough to log) |
| [`data/win-conditions.js`](../../data/win-conditions.js) | The shipped victories, registered via `escapeWithQuestItem` |
| [`data/attribute-set.js`](../../data/attribute-set.js) | The default attribute definitions loaded into the attribute registry |
| [`data/equipment-slots.js`](../../data/equipment-slots.js) | The `Slots` enum + humanoid slot set |
| [`data/transit-map.js`](../../data/transit-map.js) | The dungeon's inter-floor graph |

### The generation blackboard contract

Generation stages communicate through the level **blackboard** by string key. Import the key constants from [`blackboard-keys.js`](../../src/world/generation/blackboard-keys.js) (`LEVEL_ZONES`, `LEVEL_GRID`, `STATIC_ENTITIES`, …) rather than typing the literals — a mistyped constant is a reference error, where a mistyped string is a silent empty read. A new stage that produces or consumes blackboard state should use these constants and, if it introduces new state, add a constant there.

## API-present, UI-deferred seams

Working, tested APIs with no shipped caller — a fork can drive them directly today; first-party wiring is tracked in the [roadmap](../roadmap.md)'s deferred section.

- **Reduced motion** — `animations.setEnabled(false)` ([`animations.js`](../../src/render/animations.js)) makes every animation a no-op (draws snap to final state) and persists across `reset()`. Drive it from a `prefers-reduced-motion` read or a settings toggle. (Roadmap: "animation enable/disable config".)
- **Audio mute** — per-channel mute is implemented + tested (`setMasterMuted`, `sfx.setMuted`, `music.setMuted`; see [audio-design.md](../design/audio-design.md)) but not surfaced: `applyAudioSettings` pushes only the three volumes. Wire `*Muted` settings keys through it to expose mute. (Roadmap: "Improved audio config UI".)
