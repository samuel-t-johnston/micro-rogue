# Performance Notes
Purpose: Record the places most likely to become bottlenecks as the game scales (thousands of entities, larger maps), so they can be found again when profiling — *not* a backlog of work to do now. The game is small today and none of these are urgent. **Measure before changing anything**; the ranking below is a hypothesis, not a finding.

## Why "switch factories to classes" isn't the lever

A common scaling instinct is that JS classes (one shared prototype) beat factory functions (a fresh copy of every method per object). That cost only applies when you allocate **many objects that carry methods**. This codebase doesn't:

- **Entities** are `{ id, components: Map }` — pure data, no methods.
- **Components** (`src/world/entities/components.js`) return plain data objects — no methods.
- The **closure-bearing factories** (`createTurnManager`, `createActionSystem`, `createRenderer`, `createRng`, scenes, widgets) are singletons or near-singletons — their closure cost is paid once, not per entity.
- **Goals, senses, effects, and actions are already shared singletons**, resolved by string key through the registries (`goal-registry`, `sense-registry`, `effects`). An entity's `ai` component stores goal *names*, not function copies, so every creature of a kind points at the same goal object — the exact win a prototype would provide, without classes.

So converting factories to classes would buy almost nothing. The real risks are **algorithmic and allocation-rate**, addressed below.

## Hot spots, ranked

### 1. Quadratic perception (most likely to bite first)
Each acting entity runs its senses every turn (`src/ai/core/planning-context.js` → `applySenses`), and `src/ai/senses/vision.js` and `mega-vision.js` iterate **every** entity (`for (const e of level.entities)`) per perceiver. That is O(N²) per round across N creatures.

- **Fix direction:** query only entities within the perceiver's FOV range via the spatial index, or a coarse bucket grid — not a full scan. Algorithmic, not representational.

### 2. `findPath` BFS path copying
`src/world/map/pathfinding.js` builds each frontier node's path with `[...path, { x, y }]` — an O(path-length) copy at every node expansion (O(n²) churn for a long path) — plus an `{x,y}` object and a `"x,y"` string per neighbor. Multiplied by every chasing/investigating creature per turn.

- **Fix direction:** parent-pointer reconstruction (store came-from, rebuild the path once at the end), and/or A\* over the current BFS. (The deleted `path-finder.js` stub's `//TODO: A*?` was pointing here.)

### 3. `"x,y"` string keys in hot paths
The spatial index (`src/world/map/level.js`), FOV's `visibleTiles` (`src/engine/core/fov.js`), and `tilePerception.visible`/`memory` all key by `` `${x},${y}` `` strings. Every lookup allocates and hashes a string. The scent field already avoids this with integer indexing (`y * width + x`, `src/world/sense-systems/scent.js`).

- **Fix direction:** adopt integer tile keys (`y * width + x`) more widely. Highest-leverage *representation* change; touches several systems, so do it deliberately. The encode/decode now lives in one place — `tileKey`/`parseTileKey` (`src/engine/core/tile-key.js`) — so switching the format is a single-file change rather than ~40 scattered string literals.

### 4. Per-call allocations in tight loops
- `level.getEntitiesAt` returns a fresh `new Set()` on every miss (`src/world/map/level.js`) — called constantly by `isPassable`, FOV, and pathfinding. A shared frozen empty Set is a trivial win.
- `createTurnManager`'s `rescan()` allocates a `Set` and array each tick (`src/engine/turn/turn-manager.js`).
- Senses allocate a fresh observation/percept object per visible entity per turn; pooling would help more than any class change if this shows up.

## The one place the "class" intuition has merit

Component access is `entity.components.get('position')` — a string-keyed Map lookup, done constantly in the hottest loops. If profiling ever fingers this, the established ECS answer is **structure-of-arrays / typed component pools** (contiguous per-component arrays indexed by entity), which beats both Maps *and* class instances on cache locality. That's a large, deliberate change and explicitly **not** recommended until measurements justify it — the open Map-based component model is a chosen flexibility tradeoff (see `docs/design/jsdoc-conventions.md` and `AGENTS.md`).

## Bottom line

Treat 1–4 as profiling targets. When scale-testing, instrument first; #1 (quadratic perception) is the one to expect first. None of these is a reason to abandon the factory-function + open-ECS style, which keeps the engine extensible — the wins here are localized algorithm and allocation changes, not a paradigm shift.
