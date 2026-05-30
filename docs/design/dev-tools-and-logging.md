# Dev Tools and Logging
Purpose: Initial dev tools and logging design for ROGµE.

## Core Principles

- **Browser devtools are insufficient alone** — strong for rendering and UI, weak for emergent turn-sequence behavior and "how did the game get here" questions.
- **The event log is the primary debug artifact** — structured, in-memory, written at the moment of resolution when context is free.
- **Display strings are written at the source** — not reconstructed from structured data after the fact.
- **Support bundles over always-on persistence** — keep the event log in memory; write it out on demand or on crash, not into every autosave.

---

## The Event Log

Every significant state transition gets a log entry. The log lives in memory during a session and is not written into the autosave by default.

### Entry Structure

Each entry carries both structured data (for debugging and tooling) and a pre-rendered display string (for the player-facing message log):

```javascript
{
  turn: 412,
  actor: 'goblin-3',
  action: 'meleeAttack',
  target: 'player',
  damage: 4,
  display: 'The goblin strikes you for 4 damage.'
}
```

The `display` string is written at the point where the action resolves — where the actor's name, pronoun context ("you" vs. a named creature), and outcome details are all immediately available. Reconstructing this from structured fields later is surprisingly fiddly and produces awkward output.

### What to Log

Log every significant state transition, not just player actions:

- Player actions and their outcomes
- AI goal selection and the trigger that caused it (`{ actor, prevGoal, newGoal, trigger }`)
- Sense events that change an entity's world-state knowledge
- Damage, healing, status effect application and expiry
- Entity creation and death
- Terrain changes (tile overrides applied)
- Level transitions

Background events that never affect decisions — sense sweeps that found nothing, pathfinding that returned the same result — don't need entries. Log what changed, not what was checked.

### Display Strings

One logical event can produce one display string, multiple strings, or none:

- A hit produces one string
- A multi-hit sequence might produce a single summary string ("The goblin hits you twice for 7 damage total")
- An AI goal change produces no display string — it's debug data only

The `display` field is omitted on entries that have no player-visible output. The player-facing message log is simply the `display` values from the event log, filtered and rendered. No separate message system needed.

### Pre-rendered vs. Template-based Strings

Pre-render display strings as plain text at resolution time. Don't build a templating system unless localization is concretely on the roadmap. The complexity of `{ template: '{actor} strikes {target} for {damage} damage', ... }` is only worth it if you need to re-render strings in a different language or pronoun context later.

Write plain strings now. Note here to revisit if localization becomes real.

### Volume and Retention

A full run at one entry per action is tens of thousands of entries at most — manageable in memory. The log accumulates in a ring buffer or flat array; no trimming needed during normal play.

On session end (tab close, backgrounding), the in-memory log is lost unless a support bundle was generated. This is acceptable — the autosave captures state, and most bugs that matter are reproducible.

---

## The Debug Overlay

A togglable overlay (keyboard shortcut in development builds; possibly a gesture in release) that renders directly onto the game canvas. Browser devtools cannot give you spatial context.

**Always useful:**
- Tile coordinates on hover
- Entity IDs and current goal label rendered on the entity

**Togglable sub-layers:**
- FOV boundary (which tiles are currently visible, which are remembered, which are dark)
- Passability grid (useful when pathfinding produces unexpected results)
- Pathfinding visualization for a selected entity — show the path it computed this turn
- Scent field intensity (heat map overlay for smell-sensitive creatures)
- Light level per tile (raw value, not just the visible/dark binary)

The overlay should be a separate canvas layer composited over the game canvas, not drawn into the main rendering pipeline. This keeps debug rendering out of the release code path entirely.

---

## The AI State Inspector

Click or tap any entity in debug mode to open a panel showing:

- **Current goal stack** — all goals in priority order, with current goal highlighted, condition status for each (met / not met)
- **Active goal memory** — the memory payload on the current goal (`alertCause`, `targetLastPos`, etc.) with confidence and turn-observed
- **Last sense report** — what each sense returned on the most recent turn: positions, confidence, entity IDs
- **Last action taken** — the action the planner selected and why (which goal drove it)

This is cheap to build: it's a read of data the AI system already holds in memory. The value is high — AI bugs in roguelikes are almost always "the creature knew something it shouldn't" or "the creature didn't know something it should," and this makes both immediately visible.

---

## Support Bundles

A single download containing everything needed to reproduce a bug:

```
support-bundle-{timestamp}.json
{
  "gameVersion": "0.3.1",
  "saveVersion": 4,
  "bundledAt": "2025-04-18T20:52:00Z",
  "save": { ... },         // current save file snapshot
  "eventLog": [ ... ],     // full in-memory event log since session start
  "deviceInfo": {
    "userAgent": "...",
    "devicePixelRatio": 2,
    "screenSize": "390x844",
    "platform": "iOS"
  }
}
```

Triggered by a button in a debug menu, or automatically on unhandled exceptions. The save file alone is often insufficient to reproduce a bug — the sequence of events that produced the state is what matters.

For beta or early-access builds, consider a "report a bug" flow that generates this bundle and prompts the player to attach it. The event log's `display` strings give you a readable narrative of what happened; the structured fields give you the data to reproduce it.

---

## What Browser Devtools Cover Well

Don't rebuild what you get for free:

- **JavaScript errors and stack traces** — the console handles this; the support bundle adds game context on top
- **Rendering performance** — the Performance panel is the right tool for canvas bottlenecks
- **Network and asset loading** — covered
- **LocalStorage / IndexedDB inspection** — the Application panel reads save data directly; JSON saves pay off here

The gap is always game-state context: what turn it was, what the AI was doing, what the spatial situation looked like. That's what the overlay, inspector, and event log fill in.

---

## What to Avoid

- Writing the full event log into every autosave — it bloats saves and isn't needed for game state restoration
- Generating display strings from structured data after the fact — write them at the resolution site where context is free
- Building a templating system for display strings unless localization is real — pre-rendered text is simpler and sufficient
- Putting debug rendering into the main canvas pipeline — use a separate composited layer
- Logging sense sweeps that found nothing — log state changes, not checks