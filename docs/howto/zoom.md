# Map zoom

The map view has discrete zoom levels (roadmap M7). Pinch on touch, scroll-wheel on desktop.

## The ladder

`src/render/zoom.js` owns the ladder: `ZOOM_LEVELS = [16, 32, 48, 64]` — the on-screen tile
size in CSS px. Index 0 is the widest view; the last index is the closest. Sprites are sourced
from the **16px sheet** and scaled by an integer factor (×1–4), so every level stays
pixel-crisp (the renderer also sets `imageSmoothingEnabled = false`).

`defaultZoomIndex(isCoarsePointer)` picks the starting level: touch devices (coarse pointer)
start closer at 48px, mouse/desktop start wider at 32px. Zoom is **session-only** — it resets
to the platform default on reload and is not saved.

To change the levels or defaults, edit `zoom.js`. Nothing else hardcodes a tile size: the
renderer reads the active level every frame via `zoom.tileSize`, and the debug overlay reads it
through `getDebugFrame`.

## How it's wired

- **Renderer** (`renderer.js`) takes a `zoom` and uses `zoom.tileSize` for all geometry
  (`worldToScreen`, `screenToWorld`, culling, draws). It exposes `zoomIn()`/`zoomOut()` and a
  `get tileSize()`.
- **Input** lives in `game-scene.js`. `main.js` forwards `pointerdown/move/up/cancel` (with
  `pointerId`) and `wheel`. Wheel up zooms in, down zooms out. Pinch ratchets: each time the
  two-finger distance crosses `PINCH_STEP_RATIO`, it advances one level and re-baselines.
- Zoom anchors on the player (the camera is always player-centered) — there is no
  zoom-to-cursor.

## Tap-to-move is release-based

A map move fires on pointer **release**, not press: a tap is a press that releases within
`TAP_SLOP` px without a second finger landing. This is what lets pinch coexist with tapping (a
second finger cancels the tap before any move fires) and leaves a hook for future drag-to-pan
(a press that drifts past `TAP_SLOP` is discarded as a tap today; pan attaches there later).

A tap candidate only starts when a `pointerdown` falls through the **entire** UI widget chain
unconsumed, so pressing a HUD button never turns into a stray map move on release.

Gesture *feel* (slop, pinch ratio) is tuned by hand, not unit-tested (see AGENTS.md); the zoom
ladder and the renderer's zoom-scaled geometry are unit-tested.
