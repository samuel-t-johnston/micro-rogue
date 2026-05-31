import { getTileType } from '../world/tile-registry.js';
import { createSpriteRenderer } from './sprite-renderer.js';
import { gameConfig } from '../engine/game-config.js';

export function createRenderer({ getViewport }) {
  const { tileSize } = gameConfig;
  const sprites = createSpriteRenderer(tileSize);
  const camera = { x: 0, y: 0 }; // tile coords at screen center

  function worldToScreen(tileX, tileY) {
    const { width, height } = getViewport();
    return {
      x: Math.round((tileX - camera.x) * tileSize + width / 2),
      y: Math.round((tileY - camera.y) * tileSize + height / 2),
    };
  }

  function screenToWorld(screenX, screenY) {
    const { width, height } = getViewport();
    return {
      x: (screenX - width / 2) / tileSize + camera.x,
      y: (screenY - height / 2) / tileSize + camera.y,
    };
  }

  function drawMap(ctx, level) {
    const { width, height } = getViewport();
    const halfW = width / 2;
    const halfH = height / 2;

    const x0 = Math.max(0, Math.floor(camera.x - halfW / tileSize));
    const x1 = Math.min(level.width - 1, Math.ceil(camera.x + halfW / tileSize));
    const y0 = Math.max(0, Math.floor(camera.y - halfH / tileSize));
    const y1 = Math.min(level.height - 1, Math.ceil(camera.y + halfH / tileSize));

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tileId = level.getTile(tx, ty);
        if (!tileId) continue;
        const tile = getTileType(tileId);
        const { x, y } = worldToScreen(tx, ty);
        if (!sprites.draw(ctx, tile.sprite, x, y)) {
          ctx.fillStyle = tile.color;
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
  }

  return {
    load: () => sprites.load(),
    worldToScreen,
    screenToWorld,
    drawMap,
    setCamera(x, y) {
      camera.x = x;
      camera.y = y;
    },
  };
}
