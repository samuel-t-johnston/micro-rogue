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
localStorage I/O live in `src/save/core/save-system.js` + `src/save/core/serialize.js`. Two adjustments to
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
the stairs; the **level manager** (`src/world/dungeon/level-manager.js`) freezes the floor you leave, thaws or
generates the one you enter, and carries the player (with carried/equipped items) between them. The
shipped dungeon is a linear 3-floor stack — floor 1 static, floor 2 the random-static mazes, floor 3
the procedural 3×3 — connected by tap-to-travel stairs. Cold storage uses **model (b)**: only the
active floor's entities live in the registry. The general connection-contract system (named-port
capabilities, validation, branching, a transit-map visualizer) is designed in
[dungeon-planner.md](dungeon-planner.md) but deferred. Save schema bumped v2→v3 (current node +
frozen floors).*

---

## M6 — Smart Enemies
*Done when: Planner is in place, multiple sense types work, and squad coordination via barks is functional.*

- [x] Goal memory: per-goal memory payload with confidence and decay
- [x] Hearing sense: sound entities emitted into world, propagation, approximate position result
- [x] Smell sense: scent trail field, decay over turns, trail-following behavior
- [x] Bark system: NPC shouts route through hearing, other NPCs respond via goal evaluation
- [x] `investigate` goal: pursue uncertain position, decay to patrol

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
`src/world/sense-systems/scent.js`); creatures with a `scentSource` deposit each round, and the field **diffuses +
decays** so a moving emitter trails a fading wake and the gradient homes on where it is *now*. The
`smell` sense reports gradient **direction + profile + intensity** into a new `perception.smells`
channel; the `track-scent` goal climbs the gradient (sits below chase/attack — vision takes over once
the quarry is seen), and `player-smell` logs notable scents. Diffusion runs in a new first-class
**per-player-turn upkeep** registry (`src/engine/turn/upkeep.js`) — ordered so scent diffuses before the
autosave; scent is **saved** with the level (sparse). The centerpiece is that the **player is a
trackable emitter**: `scuttlers` (a fast, weak, 3-tile-sighted swarm that replaces the goblins in the
pillars maze) hunt the player's scent through the lattice, silent to smell but noisy to hearing.
Smell completes a consistency pass — all three senses now read an acuity component
(`vision`/`hearing`/`smell`). Deferred: scent masking, single-minded trackers, non-faction scents,
doors-block-scent (see [scent-and-smell.md](scent-and-smell.md)).*

---

## M7 — Polish and PWA
*Done when: the game is complete enough for external playtesting, runs well on a real phone, and installs as a PWA.*

- [x] Service worker: offline caching of all assets
- [x] Discrete zoom snap points: 3–4 levels, phone default closer, desktop default wider
- [x] Message log: expandable overlay, full scrollable history
- [x] Accessibility: 44×44px tap targets audit, color-not-sole-signal audit, handedness swap setting
- [x] Onboarding splash: dismissable, controls summary, hook for downstream content
- [x] Win condition - Amulet of Yendor + top stairs

*Service-worker/PWA note (landed): the M0 registration stub is now a real **network-first**
service worker (`service-worker.js`) — online loads always fetch fresh and update the cache,
offline serves from cache, navigations fall back to the cached shell. There is **no build step
and no generated file manifest**: the static-import module graph self-caches on first online
load, so the only hand-maintained list is `DYNAMIC_ASSETS` (the lazily-loaded map files +
alternate sprite-sheet size). Bump `CACHE_VERSION` to force-evict stale caches. Icons: the empty
manifest `icons` and missing `apple-touch-icon` were why iOS showed a generated white-"R"
placeholder; the green-µ favicon art is now rendered crisp to `icons/icon-{180,192,512}.png` +
a maskable 512, wired into the manifest and an `apple-touch-icon` link. See
[pwa-and-offline.md](../howto/pwa-and-offline.md). Update-reliability hardening (after an installed
iOS PWA stuck on old code): the worker now fetches with `cache: 'no-cache'` (revalidates past the
browser HTTP cache so it can't serve a stale on-device copy), and `src/main.js` auto-reloads on
`controllerchange` (guarded against the first install) so a newly-activated worker's assets take
effect immediately. `CACHE_VERSION` must be bumped per deploy — the changed bytes are what make
iOS install the new worker.*

*Zoom note (landed): a discrete zoom ladder (`src/render/zoom.js`, on-screen tile sizes
`[16, 32, 48, 64]`) replaces the fixed `gameConfig.tileSize`. Sprites source from whichever sheet
(16px/32px) scales crispest for the level **and device pixel ratio** (`pickSheetSize` — largest
sheet that upscales by a whole number to `tile × dpr`), so a dpr-2 phone uses the 32px sheet at
every level; the renderer reads `zoom.tileSize` each frame for all geometry, so the debug overlay
scales for free. Touch starts closer (48px), desktop wider (32px); session-only, not persisted.
Pinch (ratcheted) and scroll-wheel drive it. Tap-to-move moved from `pointerdown` to **release** so
pinch can coexist with tapping and drag-to-pan has a hook; a tap only starts when a press clears the
whole UI widget chain. See [zoom.md](../howto/zoom.md).*

---

## M8 — Quality of Life

- [x] Freeze and thaw previously-seen tiles on level transition
- [x] Remember furniture in previously-seen tiles (fog of war)
- [x] Click/Tap-and-hold: contextual action menu
- [x] "Look at" action - outputs to log, free action
- [x] Prevent door close when blocked
- [x] Drag to pan
- [x] Fix layout bug with hall generation in level 3
- [x] Complete sprite and glyph sets for all visible entities
- [x] Config: Sprite or Glyph (ASCII) rendering mode
- [x] Credits page

*Fog-of-war note (landed): tile memory was already per-creature on `tilePerception` (`visible` this
turn, `memory` of ever-seen tile ids). Two additions complete the fog. (1) **Furniture memory** — a
`persistVisible` marker on doors/chests/boulders/stairs marks an entity as rememberable; `applySenses`
snapshots the *appearance* (renderable) of such entities on each visible tile into
`tilePerception.rememberedEntities`, so they persist dimmed at their last-seen state (an open door
stays open until re-seen) while live actors never ghost. The rememberable test is a component list
(`REMEMBERABLE_COMPONENTS` in `planning-context.js`), open to whole classes later. (2) **Per-floor
freeze/thaw** — the player isn't frozen, so `level-manager.travel()` lifts the player's remembered
tiles + furniture into the departed floor's cold-storage record and lays the destination's back down
(empty for a never-visited floor); `cold-storage.js` stays player-agnostic. No save-version bump: both
are additive fields with tolerant defaults, no migration needed.*

---

## Pre-Alpha Checklist — Alpha v0.1.0

*Done when the engine supports a complete (simple) game experience; the codebase has been fully reviewed, and is a clean baseline for further expansion and new features.*

- [x] Full human code review and cleanup
- [x] Delete all stubs, empty dirs, unused assets
- [x] JS best practices
  - modules vs classes?
  - JS Doc comments
  - ESLint + Prettier
- [x] General Design Review
  - Unit test gaps: tests cover function/edges, avoid tests fragile to change
  - Code smells
  - Design for easy replacement and modification of systems. Design for easy modification of content.
- [x] Rearrange data modules - consider pulling out data files?
- [x] Review the “how-to” documents, correct mistakes, add missing info.
- [x] Replace/update original design docs
- [x] Spiff up GitHub and readme.md
- [x] Update version to v0.1.0

*At the end of this milestone we will move into Alpha with standard version numbers: Alpha v0.1.0.*

---

## Side Quest - Sound

*A fun little side quest to get sound into the engine.*

- [x] Audio modules - Core, music, SFX
- [x] Menu SFX
- [x] Start menu music

---

## Dev Feature - Sprite Finder page

*A dev page to make dealing with large sprite sheets delightful.*

- [x] View sprite sheets with pan/zoom
- [x] Collect sprite coordinates and export easily to sprite-catalog

---

## Alpha - v0.2.0 - Action Jackson

*Done when the engine supports wait, drop, throw actions, and short range (spear) + long-range (bow) ranged attacks. Additional features to make these work: ammo item component, needs-ammo equipment property, stackable item component, ranged attack NPC goal, ranged attack player capability. Temporary map adjustments for testing.*

- [x] Wait - UI hook for existing action
- [x] Drop item - UI hook for existing action
- [x] Drop/swap items to container - action
- [x] Throw item - action - perform the `effect` on executeConsume's target
- [x] Ranged attack - 2 tile - spear weapon - player
- [x] Ranged attack - ♾️ - bow weapon (no miss mechanic yet) - player
- [x] Ranged attack - javelin weapon (self-ammo, stackable, melee at range 1) - player
- [x] Ammunition - arrows - required for bow, stackable
- [x] Stacking - split and combine
- [x] Ranged attack - NPC Goal
- [x] Monsters use equipment - equip/unequip NPC goals?
- [x] Orc commander spawns with bow, arrows. Ranged attack goal.
- [ ] NPC open-door goal

*NPC ranged note (landed): the ranged-combat infrastructure was already creature-agnostic, so NPC use
needed only AI + content. A stamped `entityTypeId` gives every prefab a stable content identity; a new
**loadout stage** (`stage-loadout.js`) fills placed creatures' inventories from **item tables**
(`item-tables.js`) — orcs get a spear, the orc commander a bow + arrows — running after placement so it
disturbs no seeded determinism. Eager `equip-weapon`/`equip-ammo` goals wield the kit (introspecting the
creature's own body via a new `context.self`), and a unified **`attack-in-range`** goal replaces the
melee-only `attack-adjacent`, covering melee and ranged off the creature's own weapon reach. Its
clear-line test (`src/combat/targeting.js`) is shared with the player's tile-action resolver. No kiting
yet — a ranged attacker stands and shoots, with `chase-others` (ranked below) closing when out of reach.
See [docs/howto/loadouts.md](howto/loadouts.md) and [ranged-weapons.md](design/ranged-weapons.md) §13.*

---

## Alpha - v0.3.0 - Level Up

*Done when the engine supports different types of numeric attributes and pools for player and monsters, XP, and leveling up.*

- [ ] Track attributes via the component
  - "Score" type - STR, DEX, INT, CON, SPD, Level
  - "Pool" type - HP, MP, Hunger
  - "Accumulator" type - XP
- [ ] Attributes set for Player and monsters
- [ ] Gain XP on kill
- [ ] Level up at XP tiers
- [ ] Player attributes screen
- [ ] Attributes added to HUD widget
- [ ] New game Player stat allocation
- [ ] Attributes used in other systems
  - Throw/ranged miss chance?
  - Attack damage
  - Equip requirements
  - Auto-move stops on HP drop — watch current HP (read via the attribute resolver, not `health.current`) and cancel auto-move when it falls. Seed an HP watermark in `player-get-input` when arming auto-move, parallel to `knownEnemyIds` (baseline must be captured at arming time to catch damage taken before the first auto-move step); compare/refresh it in `player-auto-move` and clear it in `cancelAutoMove`. Needs HP exposed on `selfState` in `planning-context.js`. Catches already-known and out-of-vision attackers, which the new-enemy check misses.

---

## Alpha - v0.4.0 - Maps, Maps, Maps

*Done when the engine supports several visually distinct styles of random map generation, and item tables used for "floor" spawning, monster inventory, and monster loot drops.*

- [ ] Map Gen - Binary Space Partitioning
- [ ] Map Gen - Cellular Automata
- [ ] Map Gen - Drunk Walk/Digger
- [ ] Map Gen - Voronoi/Wave Function Collapse
- [ ] Item Tables
- [ ] RNG item spawn in map gen - item tables + player level
- [ ] RNG monster inventory in map gen - item tables + player level
- [ ] RNG monster loot drops - item tables

---

## Alpha - v0.5.0 - Stay Classy

*This milestone is not finalized*

- [ ] Player classes - War/Wiz/Rgr/Thf?
- [ ] Class affects attribute allocation?
- [ ] Class skill tree + points on level up
- [ ] Magic/skill system - 2 skills per class

---

## Alpha - v0.6.0 - Now is the Hour of Our More Content

*This milestone is not finalized*

- [ ] Equipment slots: head, body, legs, feed, hands, weapon, neck, finger x2?
- [ ] Equipment for all slots - 2-3 types
- [ ] 10 monsters
- [ ] 1 boss
- [ ] Attack telegraph animations

---

## Alpha - v0.7.0 - Bringing Balance to the Force

*This milestone is not finalized*

- [ ] Levels, monsters, loot, classes, skills - it all feels like a proper (small, somewhat generic) game.
- [ ] UI polish, theme adjustments, rounded buttons?

---

## Beta - v0.8.0 and Beyond

*Features driven by using the engine to build a new roguelike! Maybe a 7DRL.*

---

## Deferred / Not Scheduled

*Medium Priority / Easy:*

- [ ] "Save" button that tells the user about auto-save.
- [ ] Particles and projectile animations — leave a hook in the animation system; implement when ranged combat exists
- [ ] `flee` goal: low-HP retreat behavior
- [ ] Screen overlay effects: red vignette for low HP; reduced-motion fallback; disableable
- [ ] Emote icons: `!` alert, `?` investigating, `💤` sleeping — reusable component
- [ ] Status effects: HUD display, multi-effect overflow handling
- [ ] Light-sensitive vision sense - current unlimited vision sense becomes "darkvision". Tile light levels + light emitters
- [ ] Echolocation sense — a precise hearing-style sense that resolves *exact* source tiles via walking-distance sound propagation (the muffling / weighted path-cost model explored during M6 hearing design). Distinct from ordinary hearing, which deliberately yields only an imprecise direction + a type/classification; echolocation would pinpoint the source. High-detail and arguably more "bat sonar" than human hearing — revisit as a special creature ability or player tool.
- [ ] Score + Leaderboards
- [ ] Zoo level for dev testing
- [ ] More furniture: fountains? secret doors? 
- [ ] Zoo level for dev testing
- [ ] Developer F.A.Q.
- [ ] View RNG seed, mode where seed can be specified
- [ ] Clean up old save file versions that can only possibly exist in dev - possibly at beta

*Low Priority / Hard:*

- [ ] Configurable UI layout — anchor system supports it; only lefty/righty modes for now
- [ ] Localization / templated display strings** — revisit if localization becomes real (ADR-013)
- [ ] Dedicated map screen — zoom-out-as-map first; separate map screen only if levels outgrow it
- [ ] Multi-turn NPC/player actions — `turnsRequired` hook noted in AI architecture; don't implement until a concrete use case exists
- [ ] Re-entry pipelines — simulate time passage on level reload; levels that always randomize - revisit once real re-entry scenarios exist
- [ ] Scent masking — the counterplay to being a trackable scent emitter (see [scent-and-smell.md](scent-and-smell.md)): a way to suppress your own scent deposit, via a consumable (a `scentMask` status) or water terrain (a tile that washes scent). Without it, the only evasion against a scent tracker is distance and putting walls between you; this adds an active, item/terrain-driven option. Deferred from the first smell cut.
- [ ] Single-minded scent tracker — a tracker that commits to one quarry's scent and resists distraction by newer/stronger scents (a remembered chosen target), versus the first cut's "follow the strongest enemy scent each turn." Makes elite hunters feel relentless and harder to shake by crossing another creature's trail.
- [ ] Non-faction scents — smellable world events beyond creature factions: `blood`, food, smoke. Enables forensic cues ("fresh blood here") and luring/baiting, on the same scent-field machinery.
- [ ] Goal condition introspection — a side-effect-free per-goal predicate so the inspector can show met/not-met status per goal without running `evaluate()` (which mutates shared memory). Prerequisite for the full AI state inspector (M6); the M3 goal inspector marks the last-activated goal instead, which needs no introspection interface
- [ ] Perception-reporter pre-pass — `player-hear` and `player-smell` are pass-through "goals" that only log perceived sounds/scents as a side effect and always return `null`. This works (goals may side-effect on fall-through, and dedupe state lives in `memory`), but overloads the goal abstraction with a never-acts case and leans on stack position (must sit above the action goals). The cleaner shape is a small perception-reporter step run in `invokeAction` after `buildPlanningContext` and before `evaluateGoals`, with a `report(context)` contract (no return value, never acts) — making "never decides an action" structural rather than conventional. Not worth the parallel registry for just two player-only reporters; revisit when a third reporter appears (e.g. environmental narration like "you feel a draft"), an NPC needs narration, or the Notification layer below subsumes it.
- [ ] Terrain modification - Tile override layer: `getTile(x,y)` with override-first lookup;
- [ ] pathfinding reads `context.level` directly rather than a sense-filtered "known map" (tracked in ADR-021).
- [ ] Architecture diagrams for devs (probabaly not until beta and codebase stability)

*Huge, Cool, Difficult Things:*

- [ ] Client/Server Split - Thin client front-end communicates to server back-end with all game state. Prevent dev tools/cheats.
- [ ] Multiplayer - It's a MUD now?

*Explicitly out of scope until a concrete need exists:*

- [ ] Capacitor packaging — deferred until/unless app store distribution is needed (ADR-001)
- [ ] Font size preferences — desktop only, when settings system is built out
- [ ] ECS component subscription system** — `level.moveEntity()` is the current explicit coordination point for positional changes (ADR-018); extract to a subscription model if multiple independent systems need to react to the same component changes
- [ ] Full AI state inspector: confidence values, memory payload, all senses
- [ ] Notification layer: compare sense results turn-over-turn, fan to log and emote system