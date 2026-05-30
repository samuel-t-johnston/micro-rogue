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
- [ ] Renderer interface stub: `renderer` abstraction that owns tile geometry; sprite implementation only
- [x] Canvas setup: sized to viewport, multiplied by `devicePixelRatio`, resize/orientation handlers
- [x] Static level loader: hardcoded room, base tile array, no overrides, no entities
- [ ] Render the room: floor and wall tiles visible, camera centered, correct DPR
- [x] PWA basics: manifest.json, viewport meta tag, service worker registration stub only (no caching yet — that lands in M7).
- [ ] Debug overlay canvas: separate layer, togglable, tile coordinates on hover/tap

---

## M1 — The Player Exists
*Done when: a player entity appears on the map, moves via tap-to-move, and the turn loop ticks.*

- [ ] Entity model: base entity structure, component system, spatial index (`Map<"x,y", Entity[]>`)
- [ ] Player entity: position, `health` component, `TurnTaker` component
- [ ] Turn loop: player turn → resolve → next turn; action queue
- [ ] Tap-to-move: tap a tile, pathfinder navigates there (A* or similar); cancel on re-tap
- [ ] Context-sensitive tap: distinguish floor tap (move) from entity tap (placeholder)
- [ ] Long press: secondary action hook (no actions yet, just the detection)
- [ ] Movement slide animation: entities slide between tiles, 80–120ms
- [ ] Camera follows player
- [ ] Minimal HUD: HP number, turn count — anchored, stateless presentational component
- [ ] Event log: in-memory ring buffer, structured entries with `display` strings; last 1–2 lines ghost-visible at map edge

*Open question: exact pathfinding implementation. A* is the obvious choice; confirm no edge cases with the tile layer before committing.*

---

## M2 — The World Has Rules
*Done when: walls block movement and sight, items exist on the map and can be picked up, and the tile override layer works.*

- [ ] FOV: shadowcasting; remembered tiles vs. visible tiles vs. dark
- [ ] Tile passability and opacity enforced in movement and FOV
- [ ] Tile override layer: `getTile(x,y)` with override-first lookup; at least one dynamic tile (a door)
- [ ] `openable` component: doors open on tap, block movement and light when closed
- [ ] Passive entities: items on the map with `usable` or `equippable` components
- [ ] Item location model: discriminated union (`map`, `inventory`, `equipped`, `container`)
- [ ] Pick up: tap item → moves to inventory
- [ ] Inventory screen: full-screen modal, item list, basic use/equip/drop actions
- [ ] Character menu shell: card grid, back navigation, inventory as first card
- [ ] Debug overlay: FOV boundary layer, passability grid layer

*Note: the blackboard is not needed until map generation has stages that communicate. Stub it as an empty object in the level structure so the save format is correct, but don't implement it yet.*

---

## M3 — Something Wants to Kill You
*Done when: at least one enemy type exists, pursues the player, and combat resolves.*

- [ ] Active entity: `AI` component, `TurnTaker`, `health`, `combatStats`
- [ ] Turn order: player and enemies take turns in order; dead entities removed cleanly
- [ ] Basic AI goal stack: `attackThreat` (target visible), `patrol` (always), no GOAP yet — simple reactive behavior
- [ ] Vision sense: shadowcasting-based, light-gated, exact position + full detail
- [ ] Melee combat: attack action, damage calculation, health reduction, death
- [ ] Context-sensitive tap: tapping an enemy issues attack action
- [ ] Combat log entries: display strings at resolution site
- [ ] Action wiggle animation: attacker lunges toward target and returns
- [ ] Enemy death: entity removed, optional item drop
- [ ] Player death: save deleted, death screen shown
- [ ] AI state inspector (debug): click entity → panel showing goal stack, last sense report, last action

*Deferred to M4+: GOAP planner, hearing/smell senses, squad coordination. Basic reactive AI is sufficient to make the game playable and testable.*

---

## M4 — It Can Be Saved
*Done when: the game saves on turn-start, survives a browser close and reload, and the migration chain is in place.*

- [ ] Save system: JSON to `localStorage`, full structure per save-system.md
- [ ] Autosave on turn-start (after state is fully settled)
- [ ] `visibilitychange` handler: save on background/tab close
- [ ] Load on startup: detect existing save, offer continue vs. new game
- [ ] Death: delete save before showing death screen (not after)
- [ ] Migration chain: `loadSave()` with version check, chain runner, per-step error wrapping
- [ ] Save version 1 defined; first migration infrastructure in place (no migrations needed yet)
- [ ] Support bundle: save snapshot + event log + device info, downloadable on demand
- [ ] Game menu shell: drill-down list, settings placeholder, new game / quit

*Quit behavior note: `window.close()` is blocked in regular browser tabs (it only sometimes works in standalone PWA mode), so the M0 implementation tries it silently and accepts the no-op. A future polish pass could show a brief "you can close this tab now" message for the regular-tab case.*

---

## M5 — A Real Level
*Done when: a level is generated by the pipeline (even from a static layout set), the blackboard is functional, and level transitions work.*

- [ ] Map generation pipeline: stage runner, blackboard, seed threading through all stages
- [ ] Static structure stage: loads one of N fixed layouts, selection seeded
- [ ] Population stage: places enemies and items based on blackboard tags
- [ ] Finishing stage: entrance/exit placement, ambient detail (rubble, stains)
- [ ] Level transitions: stairs, freeze current level, load or generate next
- [ ] Frozen level serialization: full level state including blackboard, restored on return
- [ ] Player serialized at top level, not inside a level
- [ ] Multiple floors: at least 3, each generated independently

*Open question: when to introduce procedural structure stages. Validate the pipeline with static layouts first; add procedural generation once the pipeline is stable. This belongs on M6+.*

---

## M6 — Smart Enemies
*Done when: GOAP planner is in place, multiple sense types work, and squad coordination via barks is functional.*

- [ ] GOAP planner: action-space search, goal priority stack, interruption on higher-priority goal
- [ ] Goal memory: per-goal memory payload with confidence and decay
- [ ] Hearing sense: sound entities emitted into world, propagation, approximate position result
- [ ] Smell sense: scent trail field, decay over turns, trail-following behavior
- [ ] Bark system: NPC shouts route through hearing, other NPCs respond via goal evaluation
- [ ] `flee` goal: low-HP retreat behavior
- [ ] `investigate` goal: pursue uncertain position, decay to patrol
- [ ] `vendetta` goal: near-zero decay, triggered by being attacked
- [ ] Full AI state inspector: confidence values, memory payload, all senses

---

## M7 — Polish and PWA
*Done when: the game is complete enough for external playtesting, runs well on a real phone, and installs as a PWA.*

- [ ] Service worker: offline caching of all assets
- [ ] Discrete zoom snap points: 3–4 levels, phone default closer, desktop default wider
- [ ] Screen overlay effects: red vignette for low HP; reduced-motion fallback; disableable
- [ ] Emote icons: `!` alert, `?` investigating, `💤` sleeping — reusable component
- [ ] Message log: expandable overlay, full scrollable history
- [ ] Status effects: HUD display, multi-effect overflow handling
- [ ] Interruption system: player goal stack, "return control" base goal, invalidation on FOV event
- [ ] Notification layer: compare sense results turn-over-turn, fan to log and emote system
- [ ] Accessibility: 44×44px tap targets audit, color-not-sole-signal audit, handedness swap setting
- [ ] Onboarding splash: dismissable, controls summary, hook for downstream content

---

## Deferred / Not Scheduled

These are explicitly out of scope until a concrete need exists:

- **Procedural map generation** — design in detail only after static pipeline is stable and playable (see M5 note)
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