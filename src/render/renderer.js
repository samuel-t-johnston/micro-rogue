import { getTileType } from '../world/tile-registry.js';
import { createSpriteRenderer } from './sprite-renderer.js';
import { gameConfig } from '../engine/game-config.js';
import { RenderLayers } from './render-layers.js';
import { animations } from './animations.js';

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

  // Tile range covering the viewport, clamped to the level bounds.
  function getVisibleTileRange(level) {
    const { width, height } = getViewport();
    const halfW = width / 2;
    const halfH = height / 2;
    return {
      x0: Math.max(0, Math.floor(camera.x - halfW / tileSize)),
      x1: Math.min(level.width - 1, Math.ceil(camera.x + halfW / tileSize)),
      y0: Math.max(0, Math.floor(camera.y - halfH / tileSize)),
      y1: Math.min(level.height - 1, Math.ceil(camera.y + halfH / tileSize)),
    };
  }

  function drawMap(ctx, level, tilePerception) {
    const { x0, x1, y0, y1 } = getVisibleTileRange(level);

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

    for (const { entity, pos, renderable } of visible) {
      const { x, y } = worldToScreen(pos.x, pos.y);
      drawRenderable(ctx, renderable, x, y, animations.transformFor(entity.id));
    }
  }

  // Draws a renderable at screen position (x, y), optionally transformed by an
  // animation. The fast path (transform === null) draws straight to the context;
  // scale/alpha transforms wrap the draw in a save/restore so they don't leak.
  function drawRenderable(ctx, renderable, x, y, transform) {
    const px = transform ? x + transform.dx * tileSize : x;
    const py = transform ? y + transform.dy * tileSize : y;
    const scaled = transform && (transform.scaleX !== 1 || transform.scaleY !== 1);
    const faded = transform && transform.alpha !== 1;

    if (scaled || faded) {
      ctx.save();
      if (faded) ctx.globalAlpha *= transform.alpha;
      if (scaled) {
        // Pivot the scale around the tile center, or its bottom edge (so a death
        // squash flattens onto the floor rather than shrinking toward the middle).
        const ax = px + tileSize / 2;
        const ay = transform.anchor === 'bottom' ? py + tileSize : py + tileSize / 2;
        ctx.translate(ax, ay);
        ctx.scale(transform.scaleX, transform.scaleY);
        ctx.translate(-ax, -ay);
      }
    }

    if (!sprites.draw(ctx, renderable.sprite, px, py)) {
      ctx.fillStyle = renderable.color ?? '#666';
      ctx.fillRect(px, py, tileSize, tileSize);
      if (renderable.glyph) {
        ctx.fillStyle = renderable.glyphColor ?? '#fff';
        ctx.font = `bold ${Math.floor(tileSize * 0.75)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(renderable.glyph, px + tileSize / 2, py + tileSize / 2);
      }
    }

    if (scaled || faded) ctx.restore();
  }

  // Draws detached animations (death smoosh, future projectiles) — visuals that own
  // their own snapshot because no live entity backs them. Culled to visible tiles so
  // a death you can't see doesn't flash through the fog.
  function drawAnimations(ctx, tilePerception) {
    for (const anim of animations.detached()) {
      if (tilePerception && !tilePerception.visible.has(`${anim.x},${anim.y}`)) continue;
      const { x, y } = worldToScreen(anim.x, anim.y);
      drawRenderable(ctx, anim.renderable, x, y, animations.sampleDetached(anim));
    }
  }

  return {
    load: () => sprites.load(),
    tileSize,
    worldToScreen,
    screenToWorld,
    getVisibleTileRange,
    drawMap,
    drawEntities,
    drawAnimations,
    setCamera(x, y) {
      camera.x = x;
      camera.y = y;
    },
  };
}
