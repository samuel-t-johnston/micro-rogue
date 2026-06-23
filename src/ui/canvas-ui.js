/**
 * @file Stateless canvas-2D drawing primitives shared by the UI layer: panels, text, buttons,
 * word-wrap, segmented controls, and checkboxes. Render-only — callers own layout and hit-testing.
 */

/** Fills a rectangle with the theme's surface color. */
export function drawPanel(ctx, theme, { x, y, w, h }) {
  ctx.fillStyle = theme.surface;
  ctx.fillRect(x, y, w, h);
}

/** Draws `text` at (x, y) styled by `opts` (color, size, family, weight, align, baseline). */
export function drawText(ctx, text, x, y, opts = {}) {
  const {
    color = '#fff',
    size = 16,
    family = 'system-ui, sans-serif',
    weight = 'normal',
    align = 'left',
    baseline = 'top',
  } = opts;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/** Draws a themed button rect with its centered label; styles by enabled/hover state. */
export function drawButton(ctx, theme, button) {
  const { x, y, w, h, label, enabled = true, hover = false } = button;

  let fill;
  let textColor;
  if (!enabled) {
    fill = theme.surface;
    textColor = theme.textDisabled;
  } else if (hover) {
    fill = theme.accent;
    textColor = theme.bg;
  } else {
    fill = theme.primary;
    textColor = theme.bg;
  }

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);

  drawText(ctx, label, x + w / 2, y + h / 2, {
    color: textColor,
    size: 20,
    weight: '600',
    align: 'center',
    baseline: 'middle',
  });
}

/** True if point (px, py) lies within `rect` ({ x, y, w, h }). */
export function hitTest(rect, px, py) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/**
 * Word-wraps `text` to `maxWidth` (px), returning the lines. Explicit '\n's are hard breaks (a blank
 * line between paragraphs is preserved as an empty string). Sets the font from `opts` (same shape as
 * drawText) before measuring, so the wrap matches what will actually be drawn. A single word wider
 * than maxWidth is kept whole on its own line rather than split mid-word.
 */
export function wrapText(ctx, text, maxWidth, opts = {}) {
  const { size = 16, family = 'system-ui, sans-serif', weight = 'normal' } = opts;
  ctx.font = `${weight} ${size}px ${family}`;
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Equal-width segment rects spanning a control rect — the shared geometry for drawing a segmented
 * control and hit-testing it, so render and input never drift.
 */
export function segmentRects({ x, y, w, h }, count) {
  const segW = w / count;
  return Array.from({ length: count }, (_, i) => ({ x: x + i * segW, y, w: segW, h }));
}

/**
 * Draws a horizontal segmented control: `options` (string labels) as adjacent segments with the
 * `selectedIndex` one highlighted. Stateless — the caller hit-tests via segmentRects and supplies
 * the selection. Used for small mutually-exclusive choices (On/Off, Left/Right) in the settings list.
 */
export function drawSegmentedControl(ctx, theme, { x, y, w, h, options, selectedIndex }) {
  segmentRects({ x, y, w, h }, options.length).forEach((r, i) => {
    const active = i === selectedIndex;
    ctx.fillStyle = active ? theme.accent : theme.surface;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    drawText(ctx, options[i], r.x + r.w / 2, r.y + r.h / 2, {
      color: active ? theme.bg : theme.text,
      size: 14,
      weight: '600',
      align: 'center',
      baseline: 'middle',
    });
  });
}

/**
 * Draws a square checkbox at (x, y) with its `label` to the right, vertically centered on the box.
 * Checked state is a filled inset square (color, not glyph, so it survives any font). The caller owns
 * the clickable region (typically the box + label row) and hit-tests it itself.
 */
export function drawCheckbox(ctx, theme, { x, y, size, checked, label }) {
  ctx.strokeStyle = theme.textDim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  if (checked) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
  }
  drawText(ctx, label, x + size + 12, y + size / 2, {
    color: theme.text,
    size: 16,
    align: 'left',
    baseline: 'middle',
  });
}
