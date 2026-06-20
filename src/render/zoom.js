// Discrete zoom ladder for the map view (roadmap M7). Levels are on-screen tile sizes in CSS
// pixels; sprites are sourced from the 16px sheet and scaled to these by integer factors
// (×1..×4), so every level stays pixel-crisp. Index 0 is the widest view, the last index the
// closest. Pure state — input (wheel/pinch) and the renderer drive it; nothing here is persisted.

export const ZOOM_LEVELS = [16, 32, 48, 64];

const clampIndex = (i, levels) => Math.max(0, Math.min(levels.length - 1, i));

// Platform default: touch devices (coarse pointer) start closer for fat-finger legibility;
// mouse/desktop (fine pointer) start wider to show more of the map.
export function defaultZoomIndex(isCoarsePointer, levels = ZOOM_LEVELS) {
  const target = isCoarsePointer ? 48 : 32;
  const i = levels.indexOf(target);
  return i >= 0 ? i : clampIndex(Math.floor(levels.length / 2), levels);
}

export function createZoom({ levels = ZOOM_LEVELS, index = 0 } = {}) {
  let current = clampIndex(index, levels);
  return {
    get index() { return current; },
    get tileSize() { return levels[current]; },
    get canZoomIn() { return current < levels.length - 1; },
    get canZoomOut() { return current > 0; },
    zoomIn() { current = clampIndex(current + 1, levels); return current; },   // closer / bigger tiles
    zoomOut() { current = clampIndex(current - 1, levels); return current; },  // wider / smaller tiles
    setIndex(i) { current = clampIndex(i, levels); return current; },
  };
}
