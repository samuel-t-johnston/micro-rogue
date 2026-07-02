# State-Change Alerts
Purpose: Design for a shared "alert-worthy game state" detector, and its first two consumers — auto-move cancellation and an in-menu warning that lets menus stay open across turn-consuming actions without hiding new danger.

**Status: deferred to v0.3.0.** Parked during v0.2.0. Although the new-hostile trigger and the vignette + `[!]` mechanism could ship earlier, the HP-drop condition — which is what makes the alert feel complete — wants the attribute resolver that lands in v0.3.0 (Level Up). Picking the whole feature up then keeps HP on the correct data source and folds in the existing "auto-move stops on HP drop" roadmap item. See Phasing below.

---

## Motivation

Actions are **free** (return a free-action flag, don't advance the world) or **turn-consuming** (advance the world; every other entity then acts). Free actions are a UI affordance — look at a tile, open a menu, page through inventory — and the player may take them uninterrupted. The standing rule is that a turn-consuming action taken from a menu closes the menu and snaps the view back to the map (`character-menu-controller.js`: "submitting an action closes the menu, since open-during-turn-resolution behavior isn't designed yet"; the camera snap lives in `handleTurnEnd`).

That rule was a reasonable stand-in: spending a turn lets other entities move, so returning to the map guarantees the player sees any new danger. But as more turn-consuming actions become reachable from menus — equip, unequip, consume, split/combine stacks — it forces the player to re-open and re-navigate a menu after every step, in the common case where **nothing** on the map changed. The close-on-action rule pays a constant usability cost to cover an occasional safety case.

The fix has three parts:

1. **Don't close the menu by default** after a turn-consuming action.
2. **Detect** when the settled world contains a change the player should see.
3. **Alert** the player, non-specifically, so they choose to return to the map.

The detection in (2) is not new. Auto-move already stops when "an alert-worthy situation appears." Rather than write a second, subtly-different copy for menus, both should read the same shared detector — and so should future features (auto-rest, auto-explore, travel).

## Relationship to existing design

This slots under **Notification and Interruption** in [ux-design.md](ux-design.md). That section defines three tiers — Silent (log only), Ambient (emote near an entity), Interruption (invalidate the player's current goal, return control). Auto-move cancellation is a textbook **Interruption**: a higher-priority condition invalidates the movement goal and the base "return control" goal fires.

The in-menu warning is a **fourth shape** that the tier list doesn't quite cover. Control is nominally already with the player — they're driving a menu — so there is no goal to invalidate and nothing to "return" to. Forcing a return to the map is exactly the behavior we're trying to remove. Instead the alert is a *passive signal within the menu*: same trigger as an Interruption, softer response. Think of it as **Interruption's non-forcing sibling**: raise a flag, let the player act on it.

The presentation borrows the **edge vignette** already described under Animations in ux-design.md ("edge vignette for persistent status states") and the roadmap's deferred "Screen overlay effects" and "Emote icons: `!` alert" items.

## The shared detector: salience monitor

The reusable unit is a **salience monitor**. It is deliberately *not* a pure predicate ("is the world dangerous right now"), because every consumer cares about **change**, not absolute state — a monster already in view when auto-move started is not a reason to stop; a *new* one is. Change requires a remembered baseline. Auto-move already embodies this with `memory.knownEnemyIds`; the monitor generalizes it.

Two operations:

- `snapshot(context) → baseline` — captures the salient facts: the set of visible hostile entity IDs, and the player's current HP.
- `diff(baseline, context) → { alerted, reasons }` — compares a baseline against the current context and reports whether an alert-worthy change occurred, and which condition(s) fired.

Consumers own their baseline's **lifecycle**. That ownership is where the real behavior lives; the monitor itself is stateless between calls.

Suggested home: a small module read by both `src/ai/goals/player-auto-move.js` and the menu layer. It needs `perception` (visible entities + factions) and `selfState` (position, factions, HP) — the same shape the planning context already hands player goals — so `src/ai/senses/` or a sibling of the goals is the natural fit. Exact placement is left to implementation.

### Alert conditions

Two conditions to start, matching auto-move's stated criteria:

1. **A new hostile in perception.** A hostile entity ID present now that was absent in the baseline. (This is auto-move's existing, and *only current*, check.)
2. **A drop in player HP — any amount.** If current HP is below the baseline HP, alert. Any single point qualifies; the threshold can be tuned later if it feels noisy (regeneration ticks, chip damage). This condition does **not** exist in auto-move today — the refactor is what gives auto-move an HP trigger, catching already-known and out-of-vision attackers that the new-enemy check misses.

Conditions are a closed set defined by the monitor, not registered per-consumer — every consumer wants the same "should I look at the map" answer. If a future consumer needs a different set, that is a signal to add a condition to the shared list, not to fork the monitor.

New conditions land here over time (trap spotted, ally down, hazard spreading) and every consumer inherits them for free. That is the point of centralizing.

## Consumers

### Auto-move (refactor of existing behavior)

`player-auto-move.js` today inlines the new-enemy diff and stores `knownEnemyIds` in `memory`. After the refactor:

- On arming (in `player-get-input.js`, when a distant move sets `autoMoveTarget`), `snapshot()` the baseline into memory — **at arming time**, so damage taken before the first step still registers.
- Each step, `diff()` the baseline against the current context; if `alerted`, cancel auto-move and return control (unchanged outward behavior, plus the new HP trigger).
- `cancelAutoMove` clears the stored baseline.

This subsumes the v0.3.0 roadmap item "Auto-move stops on HP drop" — the HP watermark it describes *is* the monitor's HP baseline.

### In-menu warning (new)

- When a menu opens (or, more precisely, whenever the player last had the map in view — see Acknowledgement), `snapshot()` the baseline.
- While a menu is open, run `diff()` at the world's settle point (below). On `alerted`, raise the alert presentation; do **not** close the menu.
- Returning to the map acknowledges the alert and re-snapshots.

The menu itself does not need to know *why* it was alerted — it gets a boolean-ish "something changed" and shows the generic signal. Non-specificity is a feature: one mechanism, any cause.

## Evaluation timing

The alert-worthy change happens during *other* entities' turns, after the player spends one. The correct moment to evaluate is when the world has fully settled and control is about to return to the player.

The turn manager already exposes exactly this: `onTurnStart` for the player "fires the instant before it acts — every other entity has resolved since it last acted, so the world is fully settled." That is the evaluation point. When a menu is open at that moment, run the monitor; otherwise the map is already visible and no in-menu alert is needed.

(Auto-move evaluates per-step inside its own goal, as it does today — it does not use this hook.)

## Acknowledgement and reset

The menu alert needs an explicit **acknowledged baseline**, or it either re-fires forever or goes silent after the first event:

- The baseline is the state as of the player's **last acknowledgement**, not the last turn.
- Acknowledgement = the player returns to the map (the alert has done its job; they've seen the world).
- "New since acknowledged" is the alert set. So a *second* new hostile appearing while the player is still in the menu **re-fires** the pulse, because it's new relative to the acknowledged baseline — not suppressed as "already alerted."

This is the `knownEnemyIds` pattern generalized: baseline is a watermark, the alert is the delta above it, and acknowledgement resets the watermark. Making this explicit in the shared API keeps each consumer from re-deriving it.

## Presentation

Two layers, firing together on alert:

1. **Brief edge vignette pulse** — a short red pulse around the screen edges at the moment the alert fires. Motion in the periphery catches the eye where a static icon doesn't. This is a *flourish*, not a persistent state tint (distinct from the low-HP vignette in ux-design.md, though it should share the vignette rendering primitive). Reuses the "cosmetic, non-blocking" animation rule — it never gates input or turn processing.
2. **Persistent `[!]` indicator** — an alert glyph on the menu's back/exit affordance, shown until acknowledged. It is precise, always in the same place, and *colocates the alert with its remedy*: the thing that's flashing is the button that takes you back to see what changed. This is the load-bearing signal; the pulse is the attention-grabber.

Rendering: the vignette must draw **above** the full-screen menu overlays (menus cover all anchors), so it belongs at the very top of the render order, after the menu controllers' `render`. The `[!]` is part of the menu chrome and renders with the menu.

Deliberately **not** used:

- **Auto-close / forced drop-out** as the default — it's the behavior we're removing, and it discards in-menu context (a half-built stack split, a mid-comparison of equipment). Reserved only for the most severe tier (see Escalation), and optionally offered as a "always drop out on alert" accessibility/safety setting for players who want the old guarantee.
- **A forced log message** as the alert — a log line is specific by nature, which fights the non-specific goal, and it obstructs the menu the player is using. The log remains where the player looks *after* being alerted.

Accessibility, following ux-design.md:

- Color is never the sole signal — the `[!]` glyph carries the meaning; the red vignette reinforces it.
- Vignette is disableable; reduced-motion falls back to a static tint or the glyph alone.

### Deferred: haptics

A short vibration (`navigator.vibrate`) is a natural, inherently non-specific alert for this touch-first UI and pairs well with the visual. It is **out of scope here** and tracked as a separate feature — the alert firing point should be a clean seam a haptics layer can later subscribe to without reworking this design.

## Escalation: forced drop-out for lethal events

The soft in-menu alert is right for "a monster appeared" or "you took chip damage." It is *not* right for player death or a hit that could be lethal, where continuing to fiddle in a menu is never the intent. Those retain the forced return-to-map (today's behavior). The monitor can carry a severity on its `reasons` so the menu layer distinguishes "raise the flag" from "close the menu now"; death already routes through `handlePlayerDeath` independently.

## Phasing

Condition (1), new-hostile-in-perception, works with data available **today** and can ship the whole vignette + `[!]` mechanism in v0.2.0.

Condition (2), HP drop, has a data-source wrinkle: the roadmap deliberately wants HP read through the **attribute resolver**, which arrives in **v0.3.0 (Level Up)**, not `health.current`. Options:

- **Recommended:** ship the menu alert in v0.2.0 on the new-hostile trigger alone; fold the HP condition into the shared `diff` when the attribute resolver lands, at which point auto-move gains it too (retiring the separate v0.3.0 line item). One HP implementation, correct source, both consumers.
- *Interim alternative:* wire HP now via `health.current` and swap the source later — faster coverage, but writes a read the roadmap explicitly says to avoid.

The monitor's shape (snapshot/diff, HP in the baseline) is identical either way, so choosing the source is a one-line decision, not a design fork.

## Roadmap placement

- **v0.2.0:** salience monitor scaffold + new-hostile condition; auto-move refactored onto it; in-menu warning (vignette pulse + `[!]`); menus no longer close on turn-consuming actions.
- **v0.3.0:** HP-drop condition via the attribute resolver (subsumes the existing "Auto-move stops on HP drop" item); auto-move and the menu warning both inherit it.
- **Later / deferred:** haptic alert layer; additional conditions (trap spotted, ally down); "always drop out on alert" setting.

## Open questions

- **HP source & phasing** — new-hostile-only in v0.2.0 with HP folded in at v0.3.0 (recommended), or `health.current` interim now?
- **Pulse-per-event vs. pulse-once** — does every *new* alert while a menu stays open re-pulse (recommended, matches the acknowledged-baseline model), or does the pulse fire once and only the `[!]` persists until acknowledged?
- **Non-menu free-look** — the same "menu open, world changed" case exists for the future detached look-around mode (ux-design.md). The monitor covers it; whether look-around opts in now or later is left open.
