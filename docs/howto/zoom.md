# Map zoom

The map view has discrete zoom levels (roadmap M7). Pinch on touch, scroll-wheel on desktop.

## The ladder

`src/render/zoom.js` owns the ladder: `ZOOM_LEVELS = [16, 32, 48, 64]` — the on-screen tile
size in CSS px. Index 0 is the widest view; the last index is the closest. Sprites are sourced
from whichever sheet (`sprite-sheet-16.png` / `-32.png`) gives the crispest, most detailed
result for the current level **and device pixel ratio** — see `pickSheetSize` in
`sprite-renderer.js`. It picks the largest sheet that upscales to the on-screen device-pixel
size (`tile size × dpr`) by a whole number, so e.g. a dpr-2 phone draws from the 32px sheet at
every level. The renderer also sets `imageSmoothingEnabled = false` so scaling is nearest-neighbor.

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
second finger cancels the tap before any move fires) and with drag-to-pan (a press that drifts
past `TAP_SLOP` becomes a pan, never a move).

A tap candidate only starts when a `pointerdown` falls through the **entire** UI widget chain
unconsumed, so pressing a HUD button never turns into a stray map move on release.

## Drag-to-pan (free-look)

A one-finger drag (or left-button drag on desktop) past `TAP_SLOP` switches the camera from
**follow** to **free-look** and pans the viewport 1:1 with the drag. The pan math is the pure
`panCamera`/`clampCamera` in `src/render/camera-pan.js` (unit-tested); the camera centre is
clamped to the level's tile range so the map always stays mostly on screen.

The camera snaps back to the player when a **turn-finishing** player action runs
(`handleTurnEnd` flips `cameraMode` to `'follow'`) or on a level change (`mountLevel`). Free
actions don't snap back, so panning around and using **Look** keeps the free-look view; a move,
attack, or interact recenters — including a tap-to-move on a tile you panned to. There is no
manual recenter affordance yet. Free-look is view-only state and is never persisted.

While panning, a second finger ends the pan and starts a pinch-zoom; the view stays where it was
panned. The follow camera tracks the player's *visual* (sliding) position; on snap-back the
camera jumps to that position rather than gliding.

Gesture *feel* (slop, pinch ratio) is tuned by hand, not unit-tested (see AGENTS.md); the zoom
ladder and the renderer's zoom-scaled geometry are unit-tested.
