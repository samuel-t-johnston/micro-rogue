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
