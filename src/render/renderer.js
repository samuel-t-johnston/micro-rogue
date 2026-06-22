import { getTileType } from '../world/tile-registry.js';
import { createSpriteRenderer } from './sprite-renderer.js';
import { SPRITES, SHEETS } from '../../data/sprites/sprite-catalog.js';
import { RenderLayers } from './render-layers.js';
import { animations } from './animations.js';
import { createZoom, ZOOM_LEVELS } from './zoom.js';
import { gameSettings } from '../engine/settings.js';

// ASCII mode: skip sprites and draw glyphs. Read live so the Settings toggle takes effect next frame.
const glyphMode = () => gameSettings.get('renderMode') === 'glyph';

// Fills a tile with `color`, then draws `glyph` (if any) centered over it — the ASCII rendering and
// the sprite-unavailable fallback, shared by terrain and entities so both look the same.
function drawGlyphCell(ctx, { color, glyph, glyphColor }, x, y, size) {
  ctx.fillStyle = color ?? '#666';
  ctx.fillRect(x, y, size, size);
  if (glyph) {
    ctx.fillStyle = glyphColor ?? '#fff';
    ctx.font = `bold ${Math.floor(size * 0.75)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x + size / 2, y + size / 2);
  }
}

export function createRenderer({ getViewport, zoom = createZoom({ index: ZOOM_LEVELS.indexOf(32) }) }) {
  const sprites = createSpriteRenderer({ catalog: SPRITES, sheets: SHEETS });
  const camera = { x: 0, y: 0 }; // tile coords at screen center

  // The on-screen tile size in CSS px for the current zoom level. Read fresh on every call so
  // a zoom change takes effect on the next frame without re-wiring anything.
  const ts = () => zoom.tileSize;

  function worldToScreen(tileX, tileY) {
    const { width, height } = getViewport();
    const tileSize = ts();
    return {
      x: Math.round((tileX - camera.x) * tileSize + width / 2),
      y: Math.round((tileY - camera.y) * tileSize + height / 2),
    };
  }

  function screenToWorld(screenX, screenY) {
    const { width, height } = getViewport();
    const tileSize = ts();
    return {
      x: (screenX - width / 2) / tileSize + camera.x,
      y: (screenY - height / 2) / tileSize + camera.y,
    };
  }

  // Tile range covering the viewport, clamped to the level bounds.
  function getVisibleTileRange(level) {
    const { width, height } = getViewport();
    const tileSize = ts();
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
    ctx.imageSmoothingEnabled = false; // nearest-neighbor: crisp pixels when scaling sprites
    const tileSize = ts();
    const dpr = getViewport().dpr ?? 1;
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
        if (glyphMode() || !sprites.draw(ctx, tile.sprite, x, y, tileSize, dpr)) {
          drawGlyphCell(ctx, tile, x, y, tileSize);
        }
        if (!isVisible) ctx.globalAlpha = 1;
      }
    }
  }

  // Draws fog-of-war furniture: the last-seen appearance of persistVisible entities on tiles that are
  // remembered but not currently visible. Dimmed like remembered tiles (drawMap), and skipped for
  // visible tiles since drawEntities draws their live entities there. See planning-context.js.
  function drawRememberedEntities(ctx, tilePerception) {
    if (!tilePerception) return;
    ctx.imageSmoothingEnabled = false;
    const tileSize = ts();
    const { width, height } = getViewport();
    const x0 = Math.floor(camera.x - width / 2 / tileSize);
    const x1 = Math.ceil(camera.x + width / 2 / tileSize);
    const y0 = Math.floor(camera.y - height / 2 / tileSize);
    const y1 = Math.ceil(camera.y + height / 2 / tileSize);

    ctx.globalAlpha = 0.4;
    for (const [key, snapshots] of tilePerception.rememberedEntities) {
      if (tilePerception.visible.has(key)) continue;
      const [tx, ty] = key.split(',').map(Number);
      if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue;
      const { x, y } = worldToScreen(tx, ty);
      // Lower layers (items) under higher (furniture); a copy keeps the stored order intact.
      const ordered = [...snapshots].sort((a, b) => (a.layer ?? RenderLayers.DEFAULT) - (b.layer ?? RenderLayers.DEFAULT));
      for (const snap of ordered) drawRenderable(ctx, snap, x, y, null);
    }
    ctx.globalAlpha = 1;
  }

  function drawEntities(ctx, level, tilePerception) {
    const { width, height } = getViewport();
    const tileSize = ts();
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
    const tileSize = ts();
    const dpr = getViewport().dpr ?? 1;
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

    if (glyphMode() || !sprites.draw(ctx, renderable.sprite, px, py, tileSize, dpr)) {
      drawGlyphCell(ctx, renderable, px, py, tileSize);
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
    get tileSize() { return ts(); },
    worldToScreen,
    screenToWorld,
    getVisibleTileRange,
    drawMap,
    drawRememberedEntities,
    drawEntities,
    drawAnimations,
    zoomIn: () => zoom.zoomIn(),
    zoomOut: () => zoom.zoomOut(),
    setCamera(x, y) {
      camera.x = x;
      camera.y = y;
    },
  };
}
