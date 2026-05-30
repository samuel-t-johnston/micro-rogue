# UI Architecture

*The contract between canvas-drawn UI and DOM-drawn UI.*

ROGµE renders UI across two substrates: the HTML `<canvas>` (per ADR-002) for the map, HUD, and in-game menus; and DOM overlays for surfaces that need text wrapping, scrolling, or form inputs. DOM overlay support isn't built yet — it will land when the first DOM-needing surface (likely settings) is added.

## Canvas UI primitive contract

The canvas UI primitives in [`src/ui/canvas-ui.js`](../../src/ui/canvas-ui.js) are deliberately minimal:

- They draw. They do not lay out. The caller passes pixel coordinates.
- They read colors from the theme object, not from hardcoded values.
- Buttons take `enabled` and `hover` flags; rendering responds to both.
- Hit testing is a separate function; primitives don't track state.

## When something doesn't fit

When a surface can't be expressed with these primitives, that's a signal — and the answer is one of two things:

- **Add a new primitive, carefully.** Only when the new shape is going to be reused. One-off shapes belong in the calling code.
- **Render the surface in DOM instead.** The line between canvas-UI and DOM-UI runs through the contract above: if a surface needs text wrapping, scrolling, form inputs, or complex layout, it belongs in DOM.
