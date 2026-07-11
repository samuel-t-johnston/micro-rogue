# State-Change Alerts
Purpose: A shared "alert-worthy game state" detector — the **salience monitor** — and its two consumers: auto-move cancellation and an in-menu warning that lets menus stay open across turn-consuming actions without hiding new danger.

**Status: landed in v0.3.0.** Module: `src/ai/senses/salience-monitor.js` (pure `snapshot`/`diff`). Both conditions (new-hostile + HP-drop) and both consumers shipped together. This subsumed the standalone "auto-move stops on HP drop" roadmap item.

---

## Motivation

Actions are **free** (return a free-action flag, don't advance the world) or **turn-consuming** (advance the world; every other entity then acts). Free actions are a UI affordance — look at a tile, open a menu, page through inventory — and the player may take them uninterrupted.

Previously, a turn-consuming action taken from a menu **closed the menu and snapped the view back to the map**. That guaranteed the player saw any new danger — spending a turn lets other entities move — but as more turn-consuming actions became reachable from menus (equip, unequip, consume, split/combine stacks), it forced a re-open and re-navigate after every step, in the common case where **nothing** on the map changed. The rule paid a constant usability cost to cover an occasional safety case.

The fix has three parts:

1. **Don't close the menu by default** after a turn-consuming action.
2. **Detect** when the settled world contains a change the player should see.
3. **Alert** the player, non-specifically, so they choose to return to the map.

The detection in (2) is not new — auto-move already stopped when a new enemy appeared. Rather than a second, subtly-different copy for menus, both read the same shared detector — and so can future features (auto-rest, auto-explore, travel).

## Relationship to existing design

This slots under **Notification and Interruption** in [ux-design.md](ux-design.md), which defines three tiers — Silent (log only), Ambient (emote near an entity), Interruption (invalidate the player's current goal, return control). Auto-move cancellation is a textbook **Interruption**: a higher-priority condition invalidates the movement goal and the base "return control" goal fires.

The in-menu warning is a **fourth shape** the tier list doesn't quite cover. Control is nominally already with the player — they're driving a menu — so there is no goal to invalidate and nothing to "return" to; forcing a return to the map is exactly the behavior we removed. Instead the alert is a *passive signal within the menu*: same trigger as an Interruption, softer response — **Interruption's non-forcing sibling**: raise a flag, let the player act on it.

The presentation reuses the **edge vignette** primitive (`src/render/vignette.js`).

## The salience monitor

The reusable unit (`src/ai/senses/salience-monitor.js`) is deliberately *not* a pure "is the world dangerous right now" predicate, because every consumer cares about **change** against a remembered baseline, not absolute state — a monster already in view when auto-move armed is no reason to stop; a *new* one is.

Two stateless operations over the planning-context shape both consumers already hold (`{ perception, selfState }`):

- `snapshot(context) → { enemyIds, hp }` — captures the salient facts: the perceived-hostile entity IDs and the viewer's current HP.
- `diff(baseline, context) → { alerted, reasons }` — compares a baseline against the current context and reports whether an alert-worthy change occurred and which condition(s) fired.

Consumers own their baseline's **lifecycle** — that ownership is where the real behavior lives; the monitor holds no state between calls. A missing/partial baseline is inert (no alert), so a mid-move save lacking the key degrades cleanly.

Perceived hostiles use the same predicate the player goals use — an actor whose factions share nothing with the viewer's (`areHostile`, `src/combat/factions.js`) — kept in the monitor so both consumers read one definition. HP is `getPool(entity, 'hp').current`, exposed on `selfState` in `planning-context.js`.

### Alert conditions

A closed set defined by the monitor, not registered per-consumer — every consumer wants the same "should I look at the map" answer:

1. **A new hostile in perception** — a hostile ID present now that was absent in the baseline. One `{ type: 'newHostile', id }` per new id.
2. **A drop in player HP — any amount** — current HP below the baseline's yields `{ type: 'hpDrop', current, previous }`. The threshold can be tuned later if it feels noisy (regen ticks, chip damage). This is what gives auto-move an HP trigger, catching already-known and out-of-vision attackers the new-enemy check misses.

If a future consumer needs a different set, that is a signal to add a condition to the shared list (trap spotted, ally down, hazard spreading), not to fork the monitor — every consumer then inherits it for free. That is the point of centralizing.

## Consumers

### Auto-move

`player-auto-move.js` reads the planning context each step (it's a goal, evaluated after senses refresh), so it feeds the monitor directly. Baseline lifecycle is **fixed at arming**: any new hostile or HP drop cancels, so there's nothing to advance.

- On arming (`player-get-input.js`, when a distant move sets `autoMoveTarget`), `snapshot()` into `memory.autoMoveBaseline` — **at arming time**, so damage taken before the first step still registers.
- Each step, `diff()` the baseline against the current context; if `alerted`, cancel auto-move and return control.
- `cancelAutoMove` clears the stored baseline.

### In-menu warning

The menu isn't a goal, so it observes via the evaluation seam below. It advances a watermark every player turn and diffs the per-turn delta while a menu is open; on `alerted` it raises the presentation and does **not** close the menu. The menu doesn't need to know *why* — it gets a boolean-ish "something changed" and shows the generic signal. Non-specificity is a feature: one mechanism, any cause.

## Evaluation seam

The alert-worthy change happens during *other* entities' turns, after the player spends one; the correct moment to evaluate is when the world has fully settled and control is about to return to the player — with **fresh perception in hand**.

The turn manager's `onTurnStart` is *too early*: it fires before the player's per-turn `buildPlanningContext` re-runs senses, so perception there is one turn stale — it would miss exactly the new enemy the alert is for. Instead the action system calls a single optional observer, `onPlayerContext(context)`, **after `buildPlanningContext` and before `evaluateGoals`, for the player only** (`createActionSystem({ onPlayerContext })`). It reuses the exact context the goals build (no duplicate sensing) and can't act — it observes, it doesn't decide the turn.

This is the minimal seed of the roadmap's deferred "perception-reporter pre-pass / Notification layer": a single wired observer rather than a registry. Promote it to a registry when a second non-goal observer appears (auto-rest, travel, the notification fan-out).

(Auto-move needs no seam — it evaluates per-step inside its own goal, which already has the fresh context.)

## Acknowledgement and the watermark

The menu alert needs an explicit acknowledged baseline, or it either re-fires forever or goes silent after the first event. Enemies only move on player turns, so the settled world is fully captured once per player turn. The observer therefore:

- **Advances a watermark every player turn** (`snapshot(context)`), so it always represents "the world as of last turn."
- **While a menu is open**, diffs the turn's delta against that watermark. On an alert-worthy delta it fires the pulse and lights a **sticky `[!]` flag** — this yields *pulse-per-event*: a second new hostile on a later turn re-pulses (it's new relative to the advancing watermark), while a hostile that's merely still present does not.
- **While a menu is closed** (map in view), it clears the flag. Being on the map is continuous acknowledgement — you've seen the world.

The `[!]` flag is also cleared the instant the menu closes (`onClose`), so reopening never shows a stale alert. Because the watermark advances even while the menu is closed, reopening also never produces a phantom pulse.

## Presentation

Two layers, firing together on alert:

1. **Brief edge vignette pulse** — a short red "heartbeat" (`ALERT_VIGNETTE`, two quick beats) around the screen edges at the moment the alert fires. Motion in the periphery catches the eye where a static icon doesn't. It's a *flourish*, not a persistent state tint (distinct from the low-HP/starving vignette), though it shares the vignette primitive. It never gates input or turn processing.
2. **Persistent `[!]` indicator** — an alert glyph on the menu's back/exit affordance, shown until acknowledged. Precise, always in the same place, and it *colocates the alert with its remedy*: the thing that's flashing is the button that takes you back to see what changed. This is the load-bearing signal; the pulse is the attention-grabber.

Rendering: the vignette draws **above** the full-screen menu overlays (at the very top of the render order, after the menu controllers' `render`), so a warning reads even over an open menu. The `[!]` is menu chrome and renders with the menu (`character-menu.js` `drawHeader`).

Deliberately **not** used:

- **Auto-close / forced drop-out** as the default — it's the behavior we removed, and it discards in-menu context (a half-built stack split, a mid-comparison of equipment). Targeted actions that inherently need the map visible (`throw`) still close the menu, but that's an action-specific UI need, not the alert mechanism.
- **A forced log message** as the alert — a log line is specific by nature, which fights the non-specific goal, and it obstructs the menu the player is using. The log remains where the player looks *after* being alerted.

Accessibility, following ux-design.md:

- Color is never the sole signal — the `[!]` glyph carries the meaning; the red vignette reinforces it.
- The vignette honors the reduced-motion kill switch (`animations.enabled`); the `[!]` stands alone when it's off.

## Escalation and death

Player **death** needs no special handling here: it routes independently through `handlePlayerDeath → endGame`, whose outcome popup renders over the menu and captures input. The soft alert covers the rest ("a monster appeared", "you took chip damage").

A stronger tier — forcing a drop-out for a non-fatal-but-severe hit — is **not built**; the soft alert is expected to be adequate. `diff`'s `reasons` carry enough structure to add a severity later if a menu layer ever needs to distinguish "raise the flag" from "close the menu now", but there's no clean predicate for it today.

## Future / deferred

- **Haptics** — a short `navigator.vibrate` is a natural, inherently non-specific alert for this touch-first UI. Out of scope here; the `onPlayerContext` firing point is a clean seam a haptics layer can subscribe to.
- **"Always drop out on alert" accessibility setting** — restores the old force-close guarantee for players who want it; revisit nearer beta with the broader settings work.
- **Additional conditions** — trap spotted, ally down, hazard spreading: add to the monitor's closed set; every consumer inherits them.
- **Non-menu free-look** — the same "world changed while not looking at the map" case exists for the future detached look-around mode (ux-design.md). The monitor covers it; whether look-around opts in is left open.
