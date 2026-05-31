# UI Architecture

*The contract between canvas-drawn UI and DOM-drawn UI.*

ROGµE renders UI across two substrates: the HTML `<canvas>` (per ADR-002) for the map, HUD, and in-game menus; and DOM overlays for surfaces that need text wrapping, scrolling, or form inputs. DOM overlay support isn't built yet — it will land when the first DOM-needing surface (likely settings) is added.

## Canvas UI primitive contract

The canvas UI primitives in [`src/ui/canvas-ui.js`](../../src/ui/canvas-ui.js) are deliberately minimal:

- They draw. They do not lay out. The caller passes pixel coordinates.
- They read colors from the theme object, not from hardcoded values.
- Buttons take `enabled` and `hover` flags; rendering responds to both.
- Hit testing is a separate function; primitives don't track state.

## Tile rendering and sprite resolution

The renderer uses `gameConfig.tileSize` to select the sprite sheet (`sprite-sheet-${tileSize}.png`) and as the drawn tile size on screen. These are intentionally the same value for now but represent different concerns: **sprite resolution** (which sheet to use: 16 or 32) versus **display size** (how many CSS pixels a tile occupies on screen). A future `tileScale` multiplier — planned for the M7 zoom system — will control display size independently without changing the sprite sheet. Code that draws tiles should not assume drawn size equals sprite pixel size.

## When something doesn't fit

When a surface can't be expressed with these primitives, that's a signal — and the answer is one of two things:

- **Add a new primitive, carefully.** Only when the new shape is going to be reused. One-off shapes belong in the calling code.
- **Render the surface in DOM instead.** The line between canvas-UI and DOM-UI runs through the contract above: if a surface needs text wrapping, scrolling, form inputs, or complex layout, it belongs in DOM.
