# Roadmap
Purpose: This document is intended to be a place where I can jot down long-term plans for ROGµE. It is not a comprehensive roadmap and will change as implementation continues.

---

Milestones are ordered by dependency, not by time estimate. Each milestone has a clear "done" condition. Nothing in a later milestone should be started before the prior milestone's done condition is met — the point is to have something that works and can be tested at each stage.

Open questions and deferred decisions are noted inline where they land on the roadmap.

---

## M0 — Scaffolding
*Done when: a static room renders correctly on a phone browser, the PRNG is wired in, and the project structure is established.*

- [x] Project structure: directory layout, ES module setup, no bundler initially
- [x] PRNG: Mulberry32 implementation, single shared instance, seeded from a fixed value
- [x] Renderer interface stub: `renderer` abstraction that owns tile geometry; sprite implementation only
- [x] Canvas setup: sized to viewport, multiplied by `devicePixelRatio`, resize/orientation handlers
- [x] Static level loader: hardcoded room, base tile array, no overrides, no entities
- [x] Render the room: floor and wall tiles visible, camera centered, correct DPR
- [x] PWA basics: manifest.json, viewport meta tag, service worker registration stub only (no caching yet — that lands in M7).
- [x] Debug overlay canvas: separate layer, togglable, tile coordinates on hover/tap

---

## M1 — The Player Exists
*Done when: a player entity appears on the map, moves via tap-to-move, and the turn loop ticks.*

- [x] Entity model: base entity structure, component system, spatial index (`Map<"x,y", Entity[]>`)
- [x] Player entity: position, `health` component, `TurnTaker` component
- [x] Turn loop: player turn → resolve → next turn; action queue
- [x] Tap-to-move: tap a tile, pathfinder navigates there (A* or similar); cancel on re-tap
- [x] Context-sensitive tap: distinguish floor tap (move) from entity tap (placeholder)
- [x] Camera follows player
- [x] Minimal HUD: HP number, turn count — anchored, stateless presentational component
- [x] Event log: in-memory ring buffer, structured entries with `display` strings; last 1–2 lines ghost-visible at map edge

---

## M2 — The World Has Rules
*Done when: walls block movement and sight, items exist on the map and can be picked up, and the tile override layer works.*

- [x] FOV: shadowcasting; remembered tiles vs. visible tiles vs. dark. Uses senses (and possibly memory?) for tile perception.
- [x] Tile passability enforced in movement
- [x] Tile opacity enforced in FOV
- [x] `openable` component: doors open on tap, block movement and light when closed
- [x] Passive entities: items on the map with `usable` or `equippable` components
- [x] Item location model: discriminated union (`map`, `inventory`, `equipped`, `container`)
- [x] Pick up: tap item → moves to inventory
- [x] Inventory screen: full-screen modal, item list, basic use/equip/drop actions
- [x] Character menu shell: card grid, back navigation, inventory as first card
- [x] Debug overlay: FOV boundary layer, passability grid layer

*Note: the blackboard is not needed until map generation has stages that communicate. Stub it as an empty object in the level structure so the save format is correct, but don't implement it yet.*

---

## M3 — Something Wants to Kill You
*Done when: at least one enemy type exists, pursues the player, and combat resolves.*

- [x] Active entity: `AI` component, `TurnTaker`, `health`, `combatStats`
- [x] Turn order: player and enemies take turns in order; dead entities removed cleanly
- [x] Basic AI goal stack: `attackThreat` (target visible), `patrol` (always), no GOAP yet — simple reactive behavior
- [x] Vision sense: shadowcasting-based, light-gated, exact position + full detail
- [x] Melee combat: attack action, damage calculation, health reduction, death
- [x] Context-sensitive tap: tapping an enemy issues attack action
- [x] Combat log entries: display strings at resolution site
- [x] Action wiggle animation: attacker lunges toward target and returns
- [x] Movement slide animation: entities slide between tiles, 80–120ms
- [x] Enemy death: entity removed, optional item drop
- [x] Player death: death screen shown
- [x] AI goal inspector (debug): hover an entity → tooltip lists its goal stack in priority order, with the last-activated goal marked (`**`)
- [x] Interruption system: player goal stack, "return control" base goal, invalidation on FOV event

*Deferred to M4+: GOAP planner, hearing/smell senses, squad coordination. Basic reactive AI is sufficient to make the game playable and testable.*

---

## M4 — It Can Be Saved
*Done when: the game saves on turn-start, survives a browser close and reload, and the migration chain is in place.*

- [x] Save system: JSON to `localStorage`, full structure per save-system.md
- [x] Autosave on turn-start (after state is fully settled)
- [x] `visibilitychange` handler: save on background/tab close
- [x] Load on startup: detect existing save, offer continue vs. new game
- [x] Death: delete save before showing death screen (not after)
- [x] Migration chain: `loadSave()` with version check, chain runner, per-step error wrapping
- [x] Save version 1 defined; first migration infrastructure in place (no migrations needed yet)
- [x] Support bundle: save snapshot + event log + device info, downloadable on demand
- [x] Game menu shell: drill-down list, settings placeholder, new game / quit

*Persistence-core note (landed): the serialize/deserialize engine, migration runner, and
localStorage I/O live in `src/save/save-system.js` + `src/save/serialize.js`. Two adjustments to
`save-system-design.md`, forced by the code: (1) the serialization unit is the **whole entity
registry as one flat list** referenced by id — not `level.entities` — because items in
chests/inventories/equipment are entities that live only in the registry; (2) the **player is
serialized inline** like any other entity (with a top-level `playerId` pointer), not hoisted to a
top-level `player` key. The remaining M4 items (autosave hooks, visibilitychange, continue-from-menu,
death-delete, support bundle, in-game menu) wire this core into the running game.*

*Quit behavior note: `window.close()` is blocked in regular browser tabs (it only sometimes works in standalone PWA mode), so the M0 implementation tries it silently and accepts the no-op. A future polish pass could show a brief "you can close this tab now" message for the regular-tab case.*

---

## M5 — A Real Level
*Done when: a level is generated by the pipeline (even from a static layout set), the blackboard is functional, and level transitions work.*

- [x] Map generation pipeline: stage runner, blackboard, seed threading through all stages
- [x] Static structure stage: loads one of N fixed layouts, selection seeded (`randomStatic`)
- [x] Population stage: places enemies and items based on blackboard tags
- [x] Finishing stage: entrance/exit placement, ambient detail (rubble, stains)
- [x] Level transitions: stairs, freeze current level, load or generate next
- [x] Frozen level serialization: full level state including blackboard, restored on return
- [x] Multiple floors: at least 3, each generated independently

*Open question: when to introduce procedural structure stages. Validate the pipeline with static layouts first; add procedural generation once the pipeline is stable.*

*Transitions/cold-storage note (landed): a **dungeon planner** ties the floors together. A plain-data
**transit map** (`data/transit-map.js`) assigns each floor its `(branch, depth)` + pipeline and wires
the stairs; the **level manager** (`src/world/level-manager.js`) freezes the floor you leave, thaws or
generates the one you enter, and carries the player (with carried/equipped items) between them. The
shipped dungeon is a linear 3-floor stack — floor 1 static, floor 2 the random-static mazes, floor 3
the procedural 3×3 — connected by tap-to-travel stairs. Cold storage uses **model (b)**: only the
active floor's entities live in the registry. The general connection-contract system (named-port
capabilities, validation, branching, a transit-map visualizer) is designed in
[dungeon-planner.md](dungeon-planner.md) but deferred. Save schema bumped v2→v3 (current node +
frozen floors).*

---

## M6 — Smart Enemies
*Done when: GOAP planner is in place, multiple sense types work, and squad coordination via barks is functional.*

- [ ] Goal memory: per-goal memory payload with confidence and decay
- [x] Hearing sense: sound entities emitted into world, propagation, approximate position result
- [x] Smell sense: scent trail field, decay over turns, trail-following behavior
- [x] Bark system: NPC shouts route through hearing, other NPCs respond via goal evaluation
- [ ] `investigate` goal: pursue uncertain position, decay to patrol
- [ ] Full AI state inspector: confidence values, memory payload, all senses

*Hearing/bark note (landed): sounds are invisible, short-lived entities (`sound` + `decay` + `position`)
emitted explicitly by actions (the `shout` action). The turn loop ages `decay` entities one tick per
round and destroys them — sounds need no `turnTaker` (decoupled from `creature`, the new actor
marker). The `hearing` sense reports **located noise percepts** into `perception.sounds` (a new,
additive SenseResult channel) — never entity sightings — carrying an imprecise compass **direction**
(not a position), the sound's structured `message`, and whether the hearer's `knownLanguages` decode
its `language`. Barks are just this: an orc commander's `shout-enemy-report` goal emits an orcish
enemy report; regular orcs `obey-shouts` toward the understood direction until vision hands off to
chase/attack; the player logs un-understood shouts as "guttural orcish shouting to the …". Two
deferrals from the spec: the result is a **direction, not an approximate position** (deliberate — see
the Echolocation entry under Deferred / Not Scheduled for the precise variant), and propagation is **straight-line
range** for now — walking-distance + `muffling` (walls block, doors leak) is an internal upgrade to
the sense that changes no contract. Save schema bumped v3→v4 (the `creature` marker).*

*Smell/scent note (landed): a per-profile **scent field** lives on the level (`level.scent`,
`src/world/scent.js`); creatures with a `scentSource` deposit each round, and the field **diffuses +
decays** so a moving emitter trails a fading wake and the gradient homes on where it is *now*. The
`smell` sense reports gradient **direction + profile + intensity** into a new `perception.smells`
channel; the `track-scent` goal climbs the gradient (sits below chase/attack — vision takes over once
the quarry is seen), and `player-smell` logs notable scents. Diffusion runs in a new first-class
**per-player-turn upkeep** registry (`src/engine/upkeep.js`) — ordered so scent diffuses before the
autosave; scent is **saved** with the level (sparse). The centerpiece is that the **player is a
trackable emitter**: `scuttlers` (a fast, weak, 3-tile-sighted swarm that replaces the goblins in the
pillars maze) hunt the player's scent through the lattice, silent to smell but noisy to hearing.
Smell completes a consistency pass — all three senses now read an acuity component
(`vision`/`hearing`/`smell`). Deferred: scent masking, single-minded trackers, non-faction scents,
doors-block-scent (see [scent-and-smell.md](scent-and-smell.md)).*

---

## M7 — Polish and PWA
*Done when: the game is complete enough for external playtesting, runs well on a real phone, and installs as a PWA.*

- [ ] Service worker: offline caching of all assets
- [ ] Discrete zoom snap points: 3–4 levels, phone default closer, desktop default wider
- [ ] Screen overlay effects: red vignette for low HP; reduced-motion fallback; disableable
- [ ] Emote icons: `!` alert, `?` investigating, `💤` sleeping — reusable component
- [ ] Message log: expandable overlay, full scrollable history
- [ ] Status effects: HUD display, multi-effect overflow handling
- [ ] Notification layer: compare sense results turn-over-turn, fan to log and emote system
- [ ] Accessibility: 44×44px tap targets audit, color-not-sole-signal audit, handedness swap setting
- [ ] Onboarding splash: dismissable, controls summary, hook for downstream content

---

## Deferred / Not Scheduled

These are explicitly out of scope until a concrete need exists:

- **Re-entry pipelines** — simulate time passage on level reload; revisit once real re-entry scenarios exist
- **ASCII rendering mode** — renderer interface (ADR-003) leaves the hook open; implement only if wanted
- **Capacitor packaging** — deferred until/unless app store distribution is needed (ADR-001)
- **Localization / templated display strings** — revisit if localization becomes real (ADR-013)
- **Look-around mode** — draggable viewport detached from player; design threshold values when needed
- **Configurable UI layout** — anchor system supports it; hardcoded defaults for now
- **Multi-turn NPC actions** — `turnsRequired` hook noted in AI architecture; don't implement until a concrete use case exists
- **Particles and projectile animations** — leave a hook in the animation system; implement when ranged combat exists
- **Dedicated map screen** — zoom-out-as-map first; separate map screen only if levels outgrow it
- **Font size preferences** — desktop only, when settings system is built out
- **ECS component subscription system** — `level.moveEntity()` is the current explicit coordination point for positional changes (ADR-018); extract to a subscription model if multiple independent systems need to react to the same component changes
- **Long press** - secondary action hook - e.g. radial menu with options, like interact or move on an open door.
- **Echolocation sense** — a precise hearing-style sense that resolves *exact* source tiles via walking-distance sound propagation (the muffling / weighted path-cost model explored during M6 hearing design). Distinct from ordinary hearing, which deliberately yields only an imprecise direction + a type/classification; echolocation would pinpoint the source. High-detail and arguably more "bat sonar" than human hearing — revisit as a special creature ability or player tool.
- **Scent masking** — the counterplay to being a trackable scent emitter (see [scent-and-smell.md](scent-and-smell.md)): a way to suppress your own scent deposit, via a consumable (a `scentMask` status) or water terrain (a tile that washes scent). Without it, the only evasion against a scent tracker is distance and putting walls between you; this adds an active, item/terrain-driven option. Deferred from the first smell cut.
- **Single-minded scent tracker** — a tracker that commits to one quarry's scent and resists distraction by newer/stronger scents (a remembered chosen target), versus the first cut's "follow the strongest enemy scent each turn." Makes elite hunters feel relentless and harder to shake by crossing another creature's trail.
- **Non-faction scents** — smellable world events beyond creature factions: `blood`, food, smoke. Enables forensic cues ("fresh blood here") and luring/baiting, on the same scent-field machinery.
- **Goal condition introspection** — a side-effect-free per-goal predicate so the inspector can show met/not-met status per goal without running `evaluate()` (which mutates shared memory). Prerequisite for the full AI state inspector (M6); the M3 goal inspector marks the last-activated goal instead, which needs no introspection interface
- **Terrain modification** - Tile override layer: `getTile(x,y)` with override-first lookup;
- [ ] `flee` goal: low-HP retreat behavior
- [ ] GOAP planner: action-space search, goal priority stack, interruption on higher-priority goal