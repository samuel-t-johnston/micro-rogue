# Roadmap
Purpose: This document is intended to be a place where I can jot down long-term plans for ROGµE. It is not a comprehensive roadmap and will change as implementation continues.

---

Milestones are ordered by dependency, not by time estimate. Each milestone has a clear "done" condition. Nothing in a later milestone should be started before the prior milestone's done condition is met — the point is to have something that works and can be tested at each stage.

Open questions and deferred decisions are noted inline where they land on the roadmap.

---

## Pre-Alpha

*Condensed summary of completed pre-alpha features*

Core Features
- [x] Sprite or Glyph (ASCII) rendering mode. Complete sprite and glyph sets for all visible entities
- [x] Entity model: base entity structure, component system, spatial index (`Map<"x,y", Entity[]>`), Player entity
- [x] Turn loop: player and enemies take turns in order; dead entities removed cleanly
- [x] Context-sensitive tap, Tap-to-move, Pick up/auto-pick-up, attack
- [x] Contextual action menu: Click/Tap-and-hold
- [x] Melee combat: attack action, damage calculation, health reduction, death
- [x] Win conditions - Amulet of Yendor + top stairs
- [x] Player death: death screen shown

Modules/QoL
- [x] Event log: in-memory ring buffer, structured entries with `display` strings; last 1–2 lines ghost-visible at map edge
- [x] PRNG: Mulberry32 implementation, single shared instance, seeded from a fixed value
- [x] PWA/Service worker: offline caching of all assets
- [x] Save system: JSON to `localStorage`. Autosave on turn-start. Save migration chain.
- [x] Support bundle: save snapshot + event log + device info, downloadable on demand
- [x] Animations - attacker lunge, Movement slide

Screens/Widgets
- [x] Onboarding splash: dismissable, controls summary, hook for downstream content
- [x] Canvas map view, Camera follows player. Discrete zoom snap points. Drag to pan
- [x] Inventory screen
- [x] Character menu
- [x] Message log widget: expandable overlay, full scrollable history
- [x] Debug overlay, AI goal inspector
- [x] Minimal HUD widget
- [x] Credits page

Map Gen
- [x] Map generation pipeline: stage runner, blackboard
- [x] Static structure stage: loads one of N fixed layouts
- [x] Level transitions: stairs, freeze current level, load or generate next
- [x] Frozen level serialization: full level state including blackboard, restored on return

AI/Senses/Goals
- [x] Basic AI goals. Goal memory
- [x] FOV: shadowcasting; remembered tiles vs. visible tiles vs. dark. Uses senses (and memory) for player/AI tile perception.
- [x] Vision sense: shadowcasting-based, exact position + full detail
- [x] Hearing sense: sound entities emitted into world, propagation, approximate position result
- [x] Smell sense: scent trail field, decay over turns, trail-following behavior
- [x] Bark system: NPC shouts route through hearing, other NPCs respond via goal evaluation
- [x] `investigate` goal: pursue uncertain position, decay to patrol

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
- [x] NPC open-door goal

*NPC open-door note (landed): the `explore-doors-eager` goal makes wandering creatures seek out closed
doors and pass through them, spreading a squad across a level instead of milling in one room. It sits
just above `wander-aimlessly` in the orc and orc-commander stacks. Prerequisite: sight observations now
carry `tags.isOpenable` + `isOpen` (a shared `describeObservedEntity` helper, `src/ai/senses/observation-utils.js`,
keeps `vision` and `mega-vision` from drifting) so goals can reason about doors — previously a door
appeared in perception untagged. The goal keeps private state in `memory.exploreDoors` (a pursued door's
`targetId`/`targetPos` plus recently `explored` tiles that decay after 5 of the creature's turns): doors
are **acquired** only through perception, but a chosen target's open/closed state is read straight off the
entity so losing line of sight mid-approach doesn't strand it. It approaches a tile *beside* a closed door
(the door tile isn't passable), opens it when adjacent, marks its side, steps onto the door, then steps off
the far side away from where it came — the explored marks are what carry it *through* rather than back.
Gives up on unreachable, vanished, or externally-opened targets. No save-version bump — `memory.exploreDoors`
is additive with tolerant defaults.*

*NPC ranged note (landed): the ranged-combat infrastructure was already creature-agnostic, so NPC use
needed only AI + content. A stamped `entityTypeId` gives every prefab a stable content identity; a new
**loadout stage** (`stage-loadout.js`) fills placed creatures' inventories from **item tables**
(`item-tables.js`) — orcs get a spear, the orc commander a bow + arrows — running after placement so it
disturbs no seeded determinism. Eager `equip-weapon`/`equip-ammo` goals wield the kit (introspecting the
creature's own body via a new `context.selfEntity`), and a unified **`attack-in-range`** goal replaces the
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
  - Auto-move stops on HP drop — watch current HP (read via the attribute resolver, not `health.current`) and cancel auto-move when it falls. Seed an HP watermark in `player-get-input` when arming auto-move, parallel to `knownEnemyIds` (baseline must be captured at arming time to catch damage taken before the first auto-move step); compare/refresh it in `player-auto-move` and clear it in `cancelAutoMove`. Needs HP exposed on `selfState` in `planning-context.js`. Catches already-known and out-of-vision attackers, which the new-enemy check misses. Fold this into the shared salience monitor rather than building it standalone — see [state-change-alerts.md](design/state-change-alerts.md), which also covers the in-menu warning that reuses the same HP watermark.

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