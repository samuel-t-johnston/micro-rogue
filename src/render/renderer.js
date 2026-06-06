import { getTileType } from '../world/tile-registry.js';
import { createSpriteRenderer } from './sprite-renderer.js';
import { gameConfig } from '../engine/game-config.js';
import { RenderLayers } from './render-layers.js';

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

  function drawMap(ctx, level, tilePerception) {
    const { width, height } = getViewport();
    const halfW = width / 2;
    const halfH = height / 2;

    const x0 = Math.max(0, Math.floor(camera.x - halfW / tileSize));
    const x1 = Math.min(level.width - 1, Math.ceil(camera.x + halfW / tileSize));
    const y0 = Math.max(0, Math.floor(camera.y - halfH / tileSize));
    const y1 = Math.min(level.height - 1, Math.ceil(camera.y + halfH / tileSize));

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const key = `${tx},${ty}`;
        const isVisible = !tilePerception || tilePerception.visible.has(key);
        const isRemembered = tilePerception?.memory.has(key);

        if (!isVisible && !isRemembered) continue;

        // Use the remembered tile type for out-of-sight tiles (e.g. a door seen open may now be closed).
        const tileId = isVisible ? level.getTile(tx, ty) : tilePerception.memory.get(key);
        if (!tileId) continue;

        const tile = getTileType(tileId);
        const { x, y } = worldToScreen(tx, ty);

        if (!isVisible) ctx.globalAlpha = 0.4;
        if (!sprites.draw(ctx, tile.sprite, x, y)) {
          ctx.fillStyle = tile.color;
          ctx.fillRect(x, y, tileSize, tileSize);
        }
        if (!isVisible) ctx.globalAlpha = 1;
      }
    }
  }

  function drawEntities(ctx, level, tilePerception) {
    const { width, height } = getViewport();
    const halfW = width / 2;
    const halfH = height / 2;
    const x0 = Math.floor(camera.x - halfW / tileSize);
    const x1 = Math.ceil(camera.x + halfW / tileSize);
    const y0 = Math.floor(camera.y - halfH / tileSize);
    const y1 = Math.ceil(camera.y + halfH / tileSize);

    // Cull off-screen and out-of-FOV entities first, then sort by render layer so
    // lower layers (items) draw underneath higher layers (creatures, furniture).
    // Stable sort preserves insertion order for ties.
    const visible = [];
    for (const entity of level.entities) {
      const pos = entity.components.get('position');
      const renderable = entity.components.get('renderable');
      if (!pos || !renderable) continue;
      if (pos.x < x0 || pos.x > x1 || pos.y < y0 || pos.y > y1) continue;
      if (tilePerception && !tilePerception.visible.has(`${pos.x},${pos.y}`)) continue;
      visible.push({ entity, pos, renderable });
    }
    visible.sort((a, b) => (a.renderable.layer ?? RenderLayers.DEFAULT) - (b.renderable.layer ?? RenderLayers.DEFAULT));

    for (const { pos, renderable } of visible) {
      const { x, y } = worldToScreen(pos.x, pos.y);
      if (!sprites.draw(ctx, renderable.sprite, x, y)) {
        ctx.fillStyle = renderable.color ?? '#666';
        ctx.fillRect(x, y, tileSize, tileSize);
        if (renderable.glyph) {
          ctx.fillStyle = renderable.glyphColor ?? '#fff';
          ctx.font = `bold ${Math.floor(tileSize * 0.75)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(renderable.glyph, x + tileSize / 2, y + tileSize / 2);
        }
      }
    }
  }

  return {
    load: () => sprites.load(),
    worldToScreen,
    screenToWorld,
    drawMap,
    drawEntities,
    setCamera(x, y) {
      camera.x = x;
      camera.y = y;
    },
  };
}
