# UX Design
Purpose: Initial UI/UX design for ROGµE.

---

## Reactive UX and I/O

### Orientation and Screen Sizes

Three target form factors: phone, tablet, and desktop. Portrait is the default orientation on small screens; landscape is supported but not primary. Tablet and desktop are naturally landscape-dominant.

The UI does not maintain separate layout codebases for portrait and landscape. Instead, all UI elements are mounted to anchor points and the map fills whatever space remains. Portrait and landscape become the same system at different aspect ratios.

Desktop layouts will feel meaningfully different from phone layouts — more persistent info, wider map view, less modal UI. This is acceptable and expected, not a problem to paper over.

### Anchor System

UI components attach to named anchor points:

- Four corners: `top-left`, `top-right`, `bottom-left`, `bottom-right`
- Four mid-edges: `top-center`, `bottom-center`, `left-center`, `right-center`

Not all anchors are used at every screen size. The bottom-center anchor is the natural thumb zone on portrait mobile and is the primary candidate for the quick bar.

Components come in small and large variants. The same component — health display, quick bar, depth indicator — can be mounted in either size depending on form factor. The game does not distinguish between them; both receive the same state and emit the same events.

### Component Model

UI components are **stateless presentational listeners**. They receive game state pushed from the game engine, render that state, and emit input events back into the game (e.g. "use item in slot 2"). Components do not own or manage game state. If a piece of information would feel wrong to lose on device reset, it belongs in the game save or device settings — not in the component.

*Example: Quick bar slot assignments (which item lives in which slot) are game state, saved with the run. The quick bar component receives slot contents and renders them; it does not decide what's in the slots.*

User-configurable layout is future work. The anchor scaffolding supports it, but default layouts are hardcoded for now. When implemented, layout preferences will be stored at the device level (likely `localStorage`), not in the game save file.

### Input

Touch is the primary interaction model. See `mobile-roguelike-design.md` for full details. Summary:

- **Tap-to-move** with pathfinding as the primary interaction
- **Context-sensitive tap** — tapping an enemy attacks, tapping an item picks up, tapping open space moves. Tapping your own tile takes its primary action (descend stairs, pick up) or, with nothing underfoot, waits one turn — a deliberate pass for tactical positioning.
- **Long press** for secondary actions (examine, interact vs. move). On your own tile the menu always offers **Wait**, so passing a turn is reachable even when standing on stairs or an item. On an adjacent container the menu offers **Place items** alongside the default Open/take, so items move both ways (the same multi-select dialog, relabelled) without a separate transfer UI.
- **Targeting mode** for ranged actions (throw now; wands/spells later) is *item-first*: choose the item from the inventory, then a modal crosshair + "Choose a target" prompt takes over the map and the next in-FOV tap resolves the target tile (Escape cancels, drags still pan). The action itself is target-tile data, so a future *target-first* flow (long-press a tile → pick an item) can submit the same action without reworking targeting.
- Pointer type (`coarse` vs. `fine`) is a more reliable signal than screen size for choosing input defaults

**Mouse** maps cleanly onto the touch model — click where you would tap. The additional affordance is hover states: tile coordinates, enemy name and rough health, item identification preview. These are enhancements for pointer users; nothing should depend on them.

**Keyboard** is an acceleration layer, not an alternative interaction model. Everything accessible by keyboard should also be accessible by tap. Worth supporting: movement on numpad or vi-keys, hotkeys for common actions, tab navigation between UI panels. Old-school roguelike keyboard patterns — letter-keyed inventory menus, typed quantity entry — are not worth emulating; they exist because keyboard was the only input, not because they're good UX.

### Zoom

Zoom uses **discrete snap points** rather than continuous scaling. Continuous zoom on a tile game tends to land between tiles and feel slightly wrong; discrete levels keep rendering sharp and ensure clean return to a known state. A set of 3–4 snap levels is sufficient.

Snap points are the same across all devices. What varies by form factor is the **default snap level** — phones default to a closer zoom, desktop to a wider one. The minimum zoom level must always show enough tiles to be playable — 7 tiles wide is a reasonable hard floor. Tile sizes at each snap level should be integer or half-integer multiples when combined with `devicePixelRatio` to keep rendering sharp.

### Rendering Mode

Sprite rendering is the default. ASCII mode is a potential future option. If added, it requires an early architectural decision: ASCII characters have a different aspect ratio than square sprites, so the rendering layer needs an abstraction that accommodates both tile geometries. A clean `renderer` interface is worth designing for from the start even if ASCII is not immediately implemented.

---

## Menus

### Two Menus, One Shell

Two menus cover all non-map interaction: the **game menu** and the **character menu**. Both use the same shell component.

The **game menu** covers meta and configuration: new game, quit, settings, keybindings, controls reference, credits, records. It is always accessible. The title screen is not a separate screen — it is the game menu open with a background image in place of the live map.

The **character menu** covers in-run information and actions: inventory, equipment, journal, full action list, and similar. It is only accessible during an active run; its button is absent or inactive otherwise.

### Full-Screen Takeover

Both menus take over the full screen when open. On tablet and desktop, a large centered modal with a dimmed background is an acceptable alternative, but full-screen works on all form factors and is the simpler default.

Opening either menu suppresses the other — a natural consequence of the full-screen layer covering all anchor components, including the other menu button. No explicit suppression logic needed.

### Game Menu: Drill-Down List

Plain text list. Selecting an item replaces the list with that sub-screen in the same space. A back button in the top-left returns to the list. Two-handed interaction is acceptable here; game menu access is infrequent and deliberate.

### Character Menu: Card Grid

Card grid at the top level. Each card shows an icon, a label, and optionally a badge for things requiring attention (unread journal entries, unidentified items). Selecting a card opens that sub-screen in the same space, with a back button returning to the grid. Column count is left to implementation.

The character menu button defaults to the **bottom-right** anchor — easiest one-handed reach for right-handed players, still accessible for left-handed players. It is visually prominent and distinct from other anchor components; it is the primary gateway to game functions not accessible through the persistent HUD. Left/right swap is a first-class accessibility setting.

---

## Map and Viewport

### Viewport Behavior

In early development the viewport is **locked to the player character** — the camera follows the player and the map scrolls beneath it.

### Zoom as Map

Zooming fully out should reveal the whole level at a still-legible tile size, serving as the map view. This is a design constraint on both maximum level size and minimum tile size at max zoom-out. If levels remain small enough, a separate map screen may never be needed.

A dedicated map screen — showing explored terrain with fog-of-war — remains on the table for larger levels. Not planned for early development.

### Look-Around Mode (Future)

The locked viewport will eventually be replaced with a draggable viewport. The core tension: a drag that strays too far from the player risks accidental taps being interpreted as move commands.

A candidate solution is **look-around mode**: dragging the viewport beyond a threshold detaches it from the player and suppresses tap-to-move, with a visible snap-back button to return to player-centered view. Tapping the snap-back button could offer "move to this location" as an option rather than simply recentering, allowing deliberate long-distance moves from the detached view. Design and threshold values are left to implementation.

---

## Info Elements

Info elements are the persistent HUD components that display game state. Real estate is tight on mobile. Two principles apply across all of them:

**Icon + number beats text.** Labels cost space and read slower at a glance. Text belongs in menus and tooltips, not HUD components.

**Hierarchy of persistence.** Not everything needs to be always visible. HP is glanceable and critical — always on screen. Character level changes rarely — one tap away is fine. Status effects are situationally critical — visible when active, absent when not.

Game systems expose state; components decide what to consume and how to display it. The categories below are examples, not a fixed list: character attributes (HP, MP, stamina, hunger, level, class), level attributes (floor number, biome, special level indicator), and status effects (active conditions).

### Status Effects

The multi-effect case needs designing for even if it's rare. Options: truncate with a "+N more" badge that expands on tap; promote critical effects (burning, poisoned) to a more prominent position and demote passive ones. A single overflowing row of icons is not acceptable on small screens.

### Message Log

Last 1–2 lines ghost-visible at the map edge; tap to expand to a full scrollable log overlay. The ghost lines fade into the map rather than sitting in a solid panel — ambient awareness without claiming permanent screen space.

---

## Quick Bar

The quick bar is a row of slots mounted at the bottom-center anchor. Each slot holds an assignable shortcut to an item category or action category. All slots are the same type — there is no structural distinction between an action slot and an item slot. Default assignments are seeded sensibly (leftmost slot defaults to an action category, remaining slots to item categories), but the system imposes no fixed ratio. Configuration is future work; the architecture doesn't need to prevent it.

### Expanding Slots

Tapping a slot triggers the most recently used item or action in that category — one tap for the common case. Long-pressing or a secondary tap expands the slot to show all available options in that category. Selecting from the expanded list updates the slot's default for next time.

The common case must be one tap. Expansion adds one more. Any confirmation step beyond that should be reserved for destructive or irreversible actions only.

---

## Popups

The only popup pattern is a lightweight confirmation modal for irreversible, meaningfully costly actions — destroying a unique item, attacking a friendly NPC. Everything else is a full-screen menu or an anchor component.

Use sparingly — overuse trains players to dismiss without reading. Passive consequences (walking into a spotted trap, picking up a cursed item) don't warrant confirmation; the game communicates these through the log.

Confirm and cancel must be large enough to hit accurately under stress. Cancel goes on the left — natural reach for one-handed use, and the safer default if the player taps without reading.

---

## Animations

Animations are sparse but purposeful. All are cosmetic — game state resolves before any animation plays, so animations never block input or turn processing.

**Movement slide** — entities slide between tiles rather than teleporting. Fast (80–120ms) so turn pace isn't affected. Without this, movement reads as a bug even when it isn't.

**Action wiggle** — a small displacement animation accompanies attacks and actions: a lunge toward the target and return for melee, a distinct motion for spells or item use.

**Emote icons** — a reusable component that renders a small icon above any entity on the map, plays a brief entrance animation, and auto-dismisses after a set duration. Accepts an icon and a duration; nothing else. Use cases: `!` for alert, `?` for investigating, `💤` for sleeping, `❤` for charmed, speech bubble for barks. Also serves as the ambient notification channel — see Notification and Interruption.

**Screen overlay effects** — edge vignette for persistent status states: red for low health, green or purple for poison, orange for fire. Pairs with status effect icons in HUD components; not a replacement for them. Disableable in settings. Reduced-motion fallback (static tint instead of pulse) also supported.

**Dialogue** — structured NPC conversation with player responses warrants a bottom sheet or modal, distinct from the log. Ambient barks go to the log; spatial treatment (speech icon on the map near the speaker) is a future enhancement.

**Particles and projectiles (future)** — projectile animations for ranged attacks and spells add legibility for little cost. The animation system should leave a hook for them.

---

## Accessibility

**Color and iconography** — color is never the sole signal for any meaningful piece of information. Icon + color is the baseline for all status effects, threat indicators, tile types, and UI states.

**Touch targets** — all interactive elements meet a minimum tap target size of 44×44px.

**Handedness** — a first-class setting that mirrors the corner-anchored UI horizontally for left-handed reach (the character-menu button moves bottom-right → bottom-left, and the other three corner controls swap with it). Defaults to right-handed. See [handedness.md](../howto/handedness.md).

**Vignette and motion** — screen overlay vignettes are disableable in settings; reduced-motion fallback supported.

**Font size** — base font size chosen to be legible without scaling (16px minimum). On mobile, scaling text up causes overflow in already-tight components; no font scale setting on mobile. A font size preference on desktop is worth supporting when the settings system is built out.

**Screen reader** — out of scope. Canvas-based roguelikes are not tractably screen-reader accessible; an incomplete implementation would be misleading.

---

## Onboarding

Micro-rogue is a game engine with an example game. Developer onboarding lives in documentation — readme, FAQs, skill and example files. The one in-game bar worth holding: basic interaction (tap to move, tap to attack) should be self-evident without instruction. Beyond that, roguelikes are learned by doing and dying.

A single dismissable splash screen on new game start provides a freeform space for brief notes — a controls summary, flavour text, a content warning. The engine provides the hook; content is up to the downstream project.

Game-specific tutorialization is a concern for downstream projects, not for micro-rogue itself.

---

## Notification and Interruption

### Three Tiers

- **Silent** — written to the log only. Background events, minor state changes.
- **Ambient** — a spatial emote icon appears near the relevant entity, and/or a log line is written. Notable but not urgent; doesn't stop the player.
- **Interruption** — the player character's current goal is invalidated and control returns to the player.

### The Player Goal System

The player character uses the same goal and action system as NPCs, with one additional primitive: a **"return control to player" goal** at the base of the priority stack — the idle state, wait for input. No NPC has this goal.

Multi-turn player actions (tap-to-path movement, auto-rest, channeled abilities) are player goals with invalidation conditions. Interruption falls out of goal priority evaluation rather than being a special system. A new enemy entering FOV raises a higher-priority goal condition; the current movement goal is invalidated; the base "return control" goal fires.

Invalidation conditions are per-goal and registered by game systems rather than hardcoded. Specific triggers (new entity in FOV, damage taken, trap spotted) are defined by the goals that need them.

### Player Sense Processing

When the player character's senses resolve each turn, two things happen independently:

1. Sense results feed into goal evaluation — same as any NPC.
2. Sense results pass through a **player notification layer** that decides what to emit to the log and emote system.

The notification layer is player-specific and purely presentational. It compares current sense results against last turn's, identifies what changed, and fans relevant events to the log and emote system. It has no goal knowledge and no NPC equivalent. NPCs have no screen or log; the notification layer means nothing to them.

### Sound

Sound is an enhancement layer, not a load-bearing channel. The game works fully without sound. Audio cues for interruption events pair with visual signals; no information is conveyed through sound alone.