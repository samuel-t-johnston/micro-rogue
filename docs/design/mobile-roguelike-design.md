# Mobile Roguelike Design Principles
Purpose: Initial design overview for mobile support in ROGµE.

## Web vs. Native: The Verdict

Modern web is good enough when the game is well-designed. The gap between a well-built PWA and a native app has narrowed significantly. What kills mobile roguelikes is usually design decisions that don't translate from desktop, not the technology.

**Consider packaging (Capacitor, Cordova, native) only if you need:**
- Local file system access (large saves, modding)
- App store distribution/discoverability
- Heavy audio work (Web Audio has iOS quirks)
- Background processing

**Default target: PWA.** Nail the design first, then wrap later if needed. Capacitor is low-friction — it's essentially a wrapper around existing web code with native API bridges.

---

## Reference: Shattered Pixel Dungeon
The gold standard for mobile roguelike design. Key things it gets right:
- Every action is one or two taps, never more
- Inventory uses a full-screen modal, not a sidebar
- The game slows down to let you read what happened (no log spam)
- Danger states (low HP) use the whole screen, not a tiny number turning red
- Designed portrait-first, landscape second

---

## Input Design

The most critical area. Don't map keyboard actions to buttons — rethink input entirely.

- **Tap-to-move with pathfinding** — player taps a tile, character navigates there. Collapses hundreds of keypresses into one tap.
- **Context-sensitive tap** — tapping an enemy attacks, tapping an item picks up, tapping open space moves. Eliminates mode-switching.
- **Long press** for secondary actions (examine, interact vs. move)
- **Swipe** for optional quick cardinal movement
- **Avoid floating joysticks** — universally bad for grid-based games

---

## Screen Real Estate

- Design viewport for **~9–11 tiles wide** on portrait mobile (not the 80-column terminal mindset)
- Use a **camera that follows the player** — scrollable maps fight with touch navigation
- **Layer UI into separate panels/screens** — don't show map + inventory + stats simultaneously; use bottom sheet drawers or tab panels
- Stats HUD: minimal and persistent — HP, one resource, turn count. Everything else on demand.
- **Avoid pinch-to-zoom** on tile games; fix the zoom level instead

---

## Typography & Readability

- Minimum **16px** for readable text; 14px absolute floor
- Message logs: collapsible overlay, not a permanent panel eating 20% of screen
- Prefer icon + number over text labels for stats
- Test bitmap/tile fonts at mobile DPR (2–3x) — they often look fine on desktop and terrible on phone

---

## Canvas Rendering

- Size canvas to `window.innerWidth / window.innerHeight`; handle `resize` and orientation change events
- **Multiply by `devicePixelRatio`** for sharp rendering on retina — the single most common oversight
- Avoid re-rendering the full map every frame; use dirty-rectangle or layer-based rendering
- Keep heavy logic out of the rAF loop

---

## PWA Configuration

**manifest.json:**
```json
{
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1a1a2e",
  "background_color": "#000000"
}
```

**viewport meta tag:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover">
```

- `viewport-fit=cover` handles iPhone notch/Dynamic Island
- Service worker: cache all assets — roguelikes should work fully offline after first load
- "Add to Home Screen" gives full-screen with no browser chrome