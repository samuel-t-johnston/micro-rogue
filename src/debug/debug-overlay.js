/** A stable hue (0..359) for a scent profile — a small string hash so each profile tints consistently. */
export function scentHue(profile) {
  let h = 0;
  for (let i = 0; i < profile.length; i++) h = (h * 31 + profile.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Places the tooltip box near the pointer, flipping to stay on-screen: it prefers up-and-right of the
 * pointer, flips left when it would overflow the right edge, and flips below when it would clip the top.
 * @returns {{ lx: number, ly: number }} The box's top-left corner.
 */
export function fitTooltipBox(pointerX, pointerY, boxW, boxH, width) {
  let lx = pointerX + 14;
  let ly = pointerY - boxH - 6;
  if (lx + boxW > width) lx = pointerX - boxW - 6;
  if (ly < 0) ly = pointerY + 14;
  return { lx, ly };
}

/**
 * Creates the debug overlay: a full-viewport canvas that draws toggleable diagnostic layers
 * (passability, FOV, scent heatmap, sound markers) plus a pointer tooltip showing tile and entity
 * details. Layers read from a per-frame snapshot the game scene supplies via `getDebugFrame()`.
 */
export function createDebugOverlay({ getViewport }) {
  const canvas = document.getElementById('debug');
  const ctx = canvas.getContext('2d');
  let visible = false;
  let showFov = false;
  let showPassability = false;
  let showScent = false;
  let showSound = false;
  let pointerX = 0;
  let pointerY = 0;
  let pointerInfo = null;

  function drawPassabilityLayer(frame) {
    const { worldToScreen, tileSize, bounds, isPassable } = frame;
    const { x0, x1, y0, y1 } = bounds;

    ctx.lineWidth = 1;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const { x, y } = worldToScreen(tx, ty);
        if (!isPassable(tx, ty)) {
          ctx.fillStyle = 'rgba(255,32,32,0.28)';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize, tileSize);
      }
    }
  }

  function drawFovLayer(frame) {
    const { worldToScreen, tileSize, bounds, isVisible, isRemembered } = frame;
    const { x0, x1, y0, y1 } = bounds;

    // Faint tint on remembered-but-unseen tiles; currently-visible tiles stay clear.
    ctx.fillStyle = 'rgba(80,140,255,0.14)';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isRemembered(tx, ty) && !isVisible(tx, ty)) {
          const { x, y } = worldToScreen(tx, ty);
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }

    // Boundary: stroke only edges shared between a visible tile and a non-visible neighbor.
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isVisible(tx, ty)) continue;
        const { x, y } = worldToScreen(tx, ty);
        if (!isVisible(tx, ty - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + tileSize, y);
        }
        if (!isVisible(tx, ty + 1)) {
          ctx.moveTo(x, y + tileSize);
          ctx.lineTo(x + tileSize, y + tileSize);
        }
        if (!isVisible(tx - 1, ty)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + tileSize);
        }
        if (!isVisible(tx + 1, ty)) {
          ctx.moveTo(x + tileSize, y);
          ctx.lineTo(x + tileSize, y + tileSize);
        }
      }
    }
    ctx.stroke();
  }

  // Deterministic hue per scent profile, so the player's trail and an orc's cloud read distinctly.
  // Scent heatmap: each profile tinted its hue, alpha rising with intensity; profiles blend.
  function drawScentLayer(frame) {
    const { worldToScreen, tileSize, bounds, getScent } = frame;
    const { x0, x1, y0, y1 } = bounds;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const cells = getScent(tx, ty);
        if (cells.length === 0) continue;
        const { x, y } = worldToScreen(tx, ty);
        for (const { profile, intensity } of cells) {
          const a = Math.min(0.6, intensity / 40);
          ctx.fillStyle = `hsla(${scentHue(profile)}, 85%, 55%, ${a})`;
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
  }

  // Reveals the otherwise-invisible sound entities: a marker at each sound's tile, a faint ring at
  // its volume radius (the base reach, before a hearer's own range is added), and the volume.
  function drawSoundLayer(frame) {
    const { worldToScreen, tileSize, getSounds } = frame;
    ctx.font = '10px monospace';
    for (const s of getSounds()) {
      const { x, y } = worldToScreen(s.x, s.y);
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;
      ctx.strokeStyle = 'rgba(90,200,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, s.volume * tileSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(90,200,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, tileSize * 0.18), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bfeaff';
      ctx.fillText(String(s.volume), cx + tileSize * 0.2, cy - tileSize * 0.2);
    }
  }

  function drawTooltip(width, height) {
    if (!pointerInfo) return;
    const { x, y, tileName, entities, passable, opaque } = pointerInfo;

    ctx.font = '12px monospace';

    const lines = [`${x},${y}`];
    if (tileName) {
      lines.push(`${tileName}  pass:${passable ? '✓' : '✗'}  opq:${opaque ? '✓' : '✗'}`);
    }
    // Each entity prints its name; entities with an AI goal stack list their goals
    // indented below, marking the last-activated goal with `**`.
    for (const entity of entities ?? []) {
      lines.push(entity.name);
      for (const goal of entity.goals ?? []) {
        lines.push(`${goal === entity.activeGoal ? '**' : '  '} ${goal}`);
      }
    }

    const lineH = 16;
    const pad = 4;
    const maxTextW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = maxTextW + pad * 2;
    const boxH = lines.length * lineH + pad * 2;

    const { lx, ly } = fitTooltipBox(pointerX, pointerY, boxW, boxH, width);

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(lx, ly, boxW, boxH);
    ctx.fillStyle = '#00ff41';
    lines.forEach((line, i) => {
      ctx.fillText(line, lx + pad, ly + pad + (i + 1) * lineH - 3);
    });
  }

  return {
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = getViewport();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    toggle() {
      visible = !visible;
    },

    toggleFov() {
      showFov = !showFov;
    },

    togglePassability() {
      showPassability = !showPassability;
    },

    toggleScent() {
      showScent = !showScent;
    },

    toggleSound() {
      showSound = !showSound;
    },

    setPointerPos(x, y, info) {
      pointerX = x;
      pointerY = y;
      pointerInfo = info;
    },

    render(scene) {
      const { width, height } = getViewport();
      ctx.clearRect(0, 0, width, height);
      if (!visible) return;

      const anyWorldLayer = showFov || showPassability || showScent || showSound;
      const frame = anyWorldLayer ? scene?.getDebugFrame?.() : null;
      if (frame) {
        if (showPassability) drawPassabilityLayer(frame);
        if (showScent) drawScentLayer(frame);
        if (showFov) drawFovLayer(frame);
        if (showSound) drawSoundLayer(frame); // markers on top
      }

      drawTooltip(width, height);
    },
  };
}
