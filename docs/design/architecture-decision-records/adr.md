# Architecture Decision Records

Decisions made during design, recorded here for continuity. Append new ADRs as decisions are made. Never modify a settled ADR — supersede it with a new one.

Format: Context → Decision → Alternatives rejected → Consequences.

---

## ADR-001: Deployment Target
Status: Accepted

Context: Need to choose between PWA, native wrapper (Capacitor/Cordova), or native app as primary distribution target.

Decision: PWA first. Wrap with Capacitor only if a concrete need emerges (app store distribution, heavy audio, local filesystem access, background processing).

Alternatives rejected: Native-first (unnecessary complexity before the game is validated); Capacitor from day one (low friction but adds a build step with no current benefit).

Consequences: Must handle iOS quirks (Web Audio, Safari PWA gaps) in web code. No app store presence until/unless Capacitor is added. Capacitor is not ruled out — it's deferred.

---

## ADR-002: Rendering Target
Status: Accepted

Context: Need a rendering approach for the tile map and entities.

Decision: HTML Canvas. Two-layer compositing: game canvas beneath, debug overlay canvas above. Debug layer is never in the release rendering path.

Alternatives rejected: DOM/CSS tile rendering (poor performance at scale, difficult to composite); WebGL (overkill for a 2D tile game at this stage).

Consequences: Must multiply canvas dimensions by `devicePixelRatio` for sharp retina rendering. Must handle `resize` and `orientationchange` events. Must implement dirty-rect or layer-based invalidation to avoid full redraws every frame.

---

## ADR-003: Renderer Interface (Sprite vs. ASCII)
Status: Accepted

Context: Sprite tiles and ASCII characters have different aspect ratios. If ASCII mode is added later without an abstraction, the rendering layer needs significant rework. UX doc explicitly flags this as an early architectural decision.

Decision: Define a `renderer` interface from the start, even though only sprite rendering is implemented initially. The interface owns tile geometry — all code that needs tile dimensions goes through it, not hardcoded constants.

Alternatives rejected: Hardcode sprite geometry and retrofit ASCII later (breaks call sites throughout the codebase); implement both now (premature, ASCII mode is speculative).

Consequences: First commit must include the renderer interface stub. Any code that calculates pixel positions or tile sizes must go through the renderer, not inline math.

---

## ADR-004: PRNG
Status: Accepted

Context: The save system requires snapshotting exact RNG state and restoring it on load. Map generation requires full-pipeline seeded determinism. `Math.random()` is neither seedable nor serializable.

Decision: Mulberry32 as the default. Single 32-bit state integer — trivially serializable, fast, sufficient statistical quality for a game. The PRNG is an engine-level component that downstream developers can swap by providing an alternative implementation conforming to the RNG interface (`seed(n)`, `next()` → float, `getState()`, `setState(state)`).

Alternatives rejected: `Math.random()` (unserializable, unseeded); Alea (multi-word float state, awkward to snapshot); xoshiro128** (quality advantage not meaningful at roguelike sample counts; requires 4-integer seed derivation); sfc32 (best quality of the candidates, but same seeding complexity as xoshiro128** for no practical gain here).

Consequences: All random calls must go through the shared RNG instance, never `Math.random()` directly. Swapping the PRNG breaks all existing seeds — this is expected and acceptable for downstream projects making a different choice, but the default should not change once players have seeds. Stage order in the generation pipeline must be stable for seeds to reproduce correctly.

---

## ADR-005: Save Format and Storage
Status: Accepted

Context: Need a save format and browser storage mechanism.

Decision: JSON, stored in `localStorage`. Human-readable, no compression. Single save slot, overwritten at turn-start. Death deletes the save before writing a new one.

Alternatives rejected: Binary format (opaque, harder to debug and migrate); IndexedDB (async API adds complexity; localStorage is synchronous and sufficient for roguelike save sizes); multiple save slots (breaks roguelike social contract).

Consequences: Save size must stay within localStorage limits (~5MB). JSON readability pays off directly in the Application panel during development. Migrations are append-only and frozen once shipped.

---

## ADR-006: Entity Model
Status: Accepted

Context: Need to model creatures, items, and furniture without a proliferating class hierarchy.

Decision: Everything except terrain is an entity. Behavior is determined by presence of capability components (`health`, `AI`, `openable`, `container`, etc.), not by type. Active entities (creatures) have `AI` and `TurnTaker`; passive entities don't.

Alternatives rejected: Separate class hierarchies for items vs. creatures vs. furniture (combinatorial explosion when behaviors overlap); tag-only system without components (insufficient structure for complex behavior).

Consequences: The action system checks component presence, not entity type. Adding behavior to any entity is additive (attach a component) rather than structural (change the class).

---

## ADR-007: Tile Architecture
Status: Accepted

Context: Need a tile model that supports dynamic terrain without making every tile mutable.

Decision: Three-layer model. Base tile layer (typed array, compact, indexed by `y * width + x`). Sparse override layer (`"x,y" → tile object`, only where terrain has changed). Entity layer (separate, not in tile data). `getTile(x,y)` checks overrides first, falls back to base.

Alternatives rejected: Fully mutable tile objects (memory overhead, complicates serialization); storing entities in tile data (conflates two concerns, complicates the entity spatial index).

Consequences: Tiles are data, not actors. Terrain effects (`enterEffect`, `itemEffect`) live on tile type definitions; the movement system dispatches them. Ongoing state (fire burning out) uses a stationary entity on top of the tile, not tile mutation.

---

## ADR-008: Item Location Model
Status: Accepted

Context: Items exist in multiple contexts (on the map, in inventory, equipped, in a container). A single `{x, y}` field doesn't cover this cleanly.

Decision: Discriminated union for item location: `{ type: 'map', x, y }`, `{ type: 'inventory', ownerId }`, `{ type: 'equipped', ownerId, slot }`, `{ type: 'container', containerId }`.

Alternatives rejected: Nullable `{x, y}` with separate flags (ambiguous null states, error-prone); storing location implicitly by which collection the item appears in (hard to query, no single source of truth).

Consequences: All item location reads must handle the union. Serialization is straightforward — the union shape maps directly to JSON.

---

## ADR-009: Map Generation Pipeline
Status: Accepted

Context: Need a map generation approach that supports both static layouts (early development) and procedural generation (later).

Decision: Pipeline architecture. Ordered stages read from and write to shared map data and a blackboard annotation layer. Different level types are different pipeline configurations, not different systems. First implementation uses a single static-layout stage.

Alternatives rejected: Ad-hoc generation functions per level type (doesn't compose, hard to extend); full procedural pipeline from day one (premature — validate with static layouts first).

Consequences: Stage order must be stable for seeds to reproduce. Adding a stage or changing stage order breaks existing seeds (acceptable during development, worth noting at player-facing release). Blackboard is preserved in frozen level serialization.

---

## ADR-010: AI Architecture
Status: Accepted

Context: Need NPC behavior that produces legible, interesting enemies without a bespoke system per creature type.

Decision: GOAP (Goal-Oriented Action Planning) as the foundation, inspired by FEAR's AI paper. Senses are filtered world-state queries; memory is per-goal with goal-owned decay; squad communication routes through the hearing system (bark entities), not a parallel channel. Full GOAP for elite enemies; simpler reactive behavior for fodder — same component structure throughout.

Alternatives rejected: Behavior trees (less legible goal stacks, harder to express priority interruption); hardcoded state machines per enemy type (doesn't compose, can't share behavior across types); separate squad communication channel (special-cases what the sense system already handles).

Consequences: Blinding/deafening a creature is just disabling a sense component. Memory decay is configured on goals, not creatures — goals own their memory lifecycle. The player uses the same goal/action system as NPCs, with one additional primitive: a base "return control to player" goal that NPCs don't have.

---

## ADR-011: Input Model
Status: Accepted

Context: Mobile-first game needs an input model designed for touch, not adapted from keyboard.

Decision: Tap-to-move with pathfinding as the primary interaction. Context-sensitive tap (enemy → attack, item → pick up, space → move). Long press for secondary actions. Pointer type (`coarse` vs. `fine`) as the signal for input defaults, not screen size. Keyboard is an acceleration layer only — everything accessible by tap must also be accessible by tap.

Alternatives rejected: Floating joystick (universally poor for grid games); direct keyboard-to-button mapping (wrong abstraction for touch); separate touch and keyboard interaction models (tap is the canonical model; keyboard accelerates it).

Consequences: Discrete zoom snap points, not continuous pinch-to-zoom. No mode-switching UI. All tap targets minimum 44×44px.

---

## ADR-012: UI Architecture
Status: Accepted

Context: Need a UI model that works across portrait mobile, landscape tablet, and desktop without maintaining separate codebases.

Decision: Anchor-point system. UI components mount to named anchors (four corners, four mid-edges); the map fills remaining space. Components are stateless presentational listeners — they receive pushed game state and emit input events; they do not own game state. Same component, small/large variants, across form factors.

Alternatives rejected: Separate portrait/landscape layout codebases (maintenance burden); reactive/framework-driven UI (adds a dependency; game state ownership belongs in the engine, not the component tree).

Consequences: Quick bar slot assignments are game state (saved with the run), not component state. Layout preferences (future) go in `localStorage`, not in the save file. The title screen is the game menu open over a background image — not a separate screen.

---

## ADR-013: Display String Generation
Status: Accepted

Context: The event log needs both structured data (for debugging) and human-readable strings (for the message log). Strings could be pre-rendered at resolution time or reconstructed from structured data later.

Decision: Pre-render display strings as plain text at the resolution site, where actor name, pronoun context, and outcome details are immediately available. No templating system.

Alternatives rejected: Template-based strings (only worth the complexity if localization is real — it isn't); reconstructing strings from structured data post-hoc (fiddly, produces awkward output, context is no longer free).

Consequences: If localization becomes a real requirement, this decision should be revisited and a templating layer added. Note that here.

---

## ADR-014: Dev Server Root
Status: Accepted

Context: JS modules live in `src/`, static assets in `public/`, and `index.html` at the repo root. Serving only `public/` would make `src/` unreachable because dev servers block requests above their root.

Decision: Serve from the repo root. `assets/` holds static files (images, fonts, audio, CSS). `index.html` lives at the repo root and references JS modules via relative paths into `src/`.

Alternatives rejected: Using `public/` as the server root (makes `src/` unreachable); naming the folder `public/` without it being the server root (misleading — that name implies it is the root); path-aliasing in the dev server (unnecessary complexity without a build step).

Consequences: Any dev server pointed at the repo root works (`npx serve .`, VS Code Live Server, etc.). No build step required.

---

## ADR-015: Testing Framework and Approach
Status: Accepted

Context: AI-assisted development benefits significantly from a tight test loop — tests constrain model output, catch regressions in subtle places (save migrations, seeded determinism), and give a hard signal for when generated code is done. Without a testing strategy, an AI assistant left to its own devices does not adopt TDD habits, and the project accumulates plausible-looking code that hasn't been verified against intent. The project is greenfield, ES modules, no bundler, browser-targeted.

Decision: Vitest as the test runner, `happy-dom` as the DOM environment when one is needed. Test files colocated with source as `*.test.js`. TDD applied selectively: test-first for pure logic, determinism-critical code, and anything with a clean input/output shape. Test-after or not-at-all for rendering, gesture timing, animation feel, and layout — code where the spec is "looks right" rather than "produces X."

Alternatives rejected: Jest (CommonJS-first architecture, ESM still flagged as experimental, watch mode an order of magnitude slower than Vitest — the slowness erodes the TDD discipline in an AI-assisted loop); no testing framework (untenable for the migration chain and for verifying seeded determinism across the generation pipeline); 100% TDD coverage including rendering and input (premature, and the wrong tool for those surfaces — visual inspection and manual play are the right validators there); Bun or Deno test runners (smaller ecosystem, less AI-assistant familiarity, no benefit that outweighs the cost).

Consequences: Node.js becomes a development dependency. The shipped game remains browser-only with no bundler. `package.json` and `node_modules/` enter the project; `node_modules/` is gitignored. All random calls go through the seeded RNG — `Math.random()` is forbidden in source and tests. Time-dependent code uses an injected clock. Save migrations ship with frozen fixture files: a real save at the source version, committed alongside the migration, with a test that loads the fixture and asserts the post-migration shape. These fixture tests are never deleted. The agent file specifies TDD scope explicitly; the model is expected to follow it.

---