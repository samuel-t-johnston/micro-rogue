# New Game Instructions Screen

*The orientation screen shown after "New Game" and before the level loads. How it's wired, how to edit it, and how the skip setting works.*

## Flow

Selecting **New Game** in the menu routes through [`main.js`](../../src/main.js)'s `handleMenuAction`:

```
new → AppState.INSTRUCTIONS → (Start) → AppState.GAME
```

unless the player has opted out, in which case it goes straight to `AppState.GAME`. The decision lives in `main.js` (the orchestration layer that owns `startMode` and transitions), not in any scene — the instructions scene just renders and calls `onContinue`. **Continue** (load save) never shows it.

The screen itself is [`src/ui/scenes/instructions-scene.js`](../../src/ui/scenes/instructions-scene.js), a top-level scene like splash/results. Edit the `HEADING`/`BODY` constants there to change the copy; `BODY` is plain text with blank-line paragraph breaks and is word-wrapped to the viewport at render time.

## The skip setting

`skipNewGameInstructions` (boolean, default `false`) lives in [`settings.js`](../../src/engine/config/settings.js) and persists to `localStorage` like every other UI preference. It is surfaced two ways, both writing the same key so they stay in sync:

- The **"Do not display again"** checkbox on the screen — toggling it persists immediately.
- The **"Skip New Game Instructions"** toggle on the Settings menu ([`game-menu-items.js`](../../src/ui/menus/game-menu-items.js)).

## Building blocks

Two reusable primitives were added to [`canvas-ui.js`](../../src/ui/core/canvas-ui.js):

- `wrapText(ctx, text, maxWidth, opts)` — pure word-wrap to a pixel width, honoring explicit newlines; returns the lines.
- `drawCheckbox(ctx, theme, { x, y, size, checked, label })` — a square checkbox with a label; the caller owns the clickable region.

## Reuse

`createInstructionsScene` takes `showCheckbox` (default `true`); pass `false` to reuse it as a plain help/how-to page without the opt-out. No menu entry wires that up today — it's just a seam left open.
