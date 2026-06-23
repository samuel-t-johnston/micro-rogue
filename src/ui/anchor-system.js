/** Logical UI anchor positions — the eight corners and edge-centers of the viewport. */
export const Anchor = Object.freeze({
  TOP_LEFT: 'top-left',
  TOP_CENTER: 'top-center',
  TOP_RIGHT: 'top-right',
  LEFT_CENTER: 'left-center',
  RIGHT_CENTER: 'right-center',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_CENTER: 'bottom-center',
  BOTTOM_RIGHT: 'bottom-right',
});

/**
 * Resolves an anchor to its viewport pixel point.
 * @throws {Error} On an unknown anchor.
 */
export function resolveAnchor(anchor, viewport) {
  const { width, height } = viewport;
  switch (anchor) {
    case Anchor.TOP_LEFT:      return { x: 0, y: 0 };
    case Anchor.TOP_CENTER:    return { x: Math.floor(width / 2), y: 0 };
    case Anchor.TOP_RIGHT:     return { x: width, y: 0 };
    case Anchor.LEFT_CENTER:   return { x: 0, y: Math.floor(height / 2) };
    case Anchor.RIGHT_CENTER:  return { x: width, y: Math.floor(height / 2) };
    case Anchor.BOTTOM_LEFT:   return { x: 0, y: height };
    case Anchor.BOTTOM_CENTER: return { x: Math.floor(width / 2), y: height };
    case Anchor.BOTTOM_RIGHT:  return { x: width, y: height };
    default: throw new Error(`Unknown anchor: ${anchor}`);
  }
}

// Each anchor paired with its left↔right reflection. Center-column anchors map to
// themselves (no horizontal component to flip).
const HORIZONTAL_MIRROR = Object.freeze({
  [Anchor.TOP_LEFT]: Anchor.TOP_RIGHT,
  [Anchor.TOP_RIGHT]: Anchor.TOP_LEFT,
  [Anchor.LEFT_CENTER]: Anchor.RIGHT_CENTER,
  [Anchor.RIGHT_CENTER]: Anchor.LEFT_CENTER,
  [Anchor.BOTTOM_LEFT]: Anchor.BOTTOM_RIGHT,
  [Anchor.BOTTOM_RIGHT]: Anchor.BOTTOM_LEFT,
  [Anchor.TOP_CENTER]: Anchor.TOP_CENTER,
  [Anchor.BOTTOM_CENTER]: Anchor.BOTTOM_CENTER,
});

/**
 * Resolves a widget's *logical* anchor to a *physical* one for the given handedness. A left-handed
 * layout mirrors the corner-anchored UI across the vertical axis so the primary controls fall under
 * the other thumb; right-handed is the identity. This is the one place handedness touches layout —
 * widgets declare a logical anchor and call this.
 */
export function applyHandedness(anchor, handedness) {
  if (handedness !== 'left') return anchor;
  return HORIZONTAL_MIRROR[anchor] ?? anchor;
}

/**
 * Places a box of size w×h at an anchor, inset `margin` inward from each edge it touches; a center
 * axis centers the box on that axis. Centralizing the corner math means mirroring for handedness is
 * just mirroring the anchor — the inset direction follows automatically.
 */
export function placeBox(anchor, viewport, { w, h, margin = 0 }) {
  const { x, y } = resolveAnchor(anchor, viewport);
  const bx = x === 0 ? margin : x === viewport.width ? x - margin - w : x - w / 2;
  const by = y === 0 ? margin : y === viewport.height ? y - margin - h : y - h / 2;
  return { x: bx, y: by, w, h };
}
