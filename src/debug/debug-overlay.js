export function createDebugOverlay({ getViewport }) {
  const canvas = document.getElementById('debug');
  const ctx = canvas.getContext('2d');
  let visible = false;
  let showFov = false;
  let showPassability = false;
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
        if (!isVisible(tx, ty - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + tileSize, y); }
        if (!isVisible(tx, ty + 1)) { ctx.moveTo(x, y + tileSize); ctx.lineTo(x + tileSize, y + tileSize); }
        if (!isVisible(tx - 1, ty)) { ctx.moveTo(x, y); ctx.lineTo(x, y + tileSize); }
        if (!isVisible(tx + 1, ty)) { ctx.moveTo(x + tileSize, y); ctx.lineTo(x + tileSize, y + tileSize); }
      }
    }
    ctx.stroke();
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
    const maxTextW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxTextW + pad * 2;
    const boxH = lines.length * lineH + pad * 2;

    let lx = pointerX + 14;
    let ly = pointerY - boxH - 6;
    if (lx + boxW > width) lx = pointerX - boxW - 6;
    if (ly < 0) ly = pointerY + 14;

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

    setPointerPos(x, y, info) {
      pointerX = x;
      pointerY = y;
      pointerInfo = info;
    },

    render(scene) {
      const { width, height } = getViewport();
      ctx.clearRect(0, 0, width, height);
      if (!visible) return;

      const frame = (showFov || showPassability) ? scene?.getDebugFrame?.() : null;
      if (frame) {
        if (showPassability) drawPassabilityLayer(frame);
        if (showFov) drawFovLayer(frame);
      }

      drawTooltip(width, height);
    },
  };
}
