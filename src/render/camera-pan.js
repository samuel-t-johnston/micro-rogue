// Pure camera math for drag-to-pan. The camera is in tile coordinates (its position is the tile at
// screen center); a pan converts a screen-pixel drag into a tile-space shift and clamps the result so
// the level stays mostly on-screen. Kept free of renderer/scene state so it can be unit-tested.

// Clamps the camera center to the level's tile range, so the centre always sits over a tile and a
// large portion of the map stays visible no matter how far the player drags.
export function clampCamera({ x, y }, { width, height }) {
  return {
    x: Math.max(0, Math.min(width - 1, x)),
    y: Math.max(0, Math.min(height - 1, y)),
  };
}

// Applies a screen-pixel drag to the camera. Dragging the finger right (dxScreen > 0) reveals content
// to the left, so the camera moves left — hence the subtraction. The drag is divided by the current
// tile size to convert pixels to tiles, then clamped to the level bounds.
export function panCamera(camera, dxScreen, dyScreen, tileSize, bounds) {
  return clampCamera({
    x: camera.x - dxScreen / tileSize,
    y: camera.y - dyScreen / tileSize,
  }, bounds);
}
