# Support Bundle

*A downloadable diagnostic snapshot for bug reports — the live save, the event log, and device
info in one JSON file.*

## Generate one

During an **active game**, press **`?`** (Shift-/). The browser downloads
`rogue-support-<timestamp>.json`. The key is deliberately obscure to avoid accidental presses; a
menu entry is the eventual home (see [menus.md](menus.md)).

It only fires while you're actually playing — on the menus, the death screen, or with any overlay
open, input is intercepted first, so the press does nothing.

## What's inside

Built by [`buildSupportBundle`](../../src/save/support-bundle/support-bundle.js):

| Field | Contents |
|---|---|
| `bundleVersion` | envelope version (independent of save/game versions) |
| `generatedAt` | ISO timestamp |
| `gameVersion` | from [`save-system.js`](../../src/save/core/save-system.js) |
| `device` | best-effort `navigator`/`window` readout — user agent, language, viewport, DPR, screen |
| `save` | the **live** game state, straight from `serializeGame` ([save-system-design.md](../design/save-system-design.md)) |
| `log` | the full event log (`gameLog.getAll()`) — every entry, not just the displayed lines |

## Worth knowing

- **The save snapshot is the live state**, not the last autosave — it reuses `serializeGame`, so the bundle's `save` block is exactly the save-file format and the two can never disagree.
- **The full log travels**, including debug-only entries with no `display` string — that's the point for diagnosing "what actually happened."
- **`buildSupportBundle` is pure and unit-tested**; `downloadSupportBundle` is a thin DOM side effect (Blob + anchor).
- Wired into the game at the `?` handler in [`game-scene.js`](../../src/ui/scenes/game-scene.js).
