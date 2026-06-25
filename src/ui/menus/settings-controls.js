import {
  drawText,
  drawSegmentedControl,
  segmentRects,
  wrapText,
  hitTest,
} from '../core/canvas-ui.js';

/**
 * @file Renders the Settings sub-page as a vertical list of rows, each a left-aligned label with an
 * optional wrapped description below it and a right-aligned segmented control beneath that.
 * Distinct from menu-shell's centered action buttons: settings are label + value, not buttons, and
 * need room for explanatory text.
 *
 * A row is { id, label, description?, options: [{label, value}], get(): value, set(value) }.
 * `get` is read every frame so the highlighted segment always reflects live state; segment taps
 * call `set`. Bound to a store (gameSettings) by the row's author — this module stays store-agnostic.
 */
const MARGIN = 16;
const MAX_COL = 520; // cap the column on desktop; phones use near-full width
const TOP = MARGIN + 44 + 28; // below the corner button / title header
const ROW_GAP = 18;
const ROW_PAD = 10;
const LABEL_SIZE = 18;
const DESC_SIZE = 14;
const DESC_LINE_H = 19;
const DESC_GAP = 4;
const CONTROL_GAP = 10;
const CONTROL_H = 44; // meets the 44px tap-target floor
const SEG_W = 64; // per-segment width

/**
 * Computes per-row geometry. Needs `ctx` to measure/wrap descriptions, so the caller drives it from
 * render and reuses the result for hit-testing (geometry depends on the wrapped text height).
 */
export function layoutSettingsRows(ctx, getViewport, rows) {
  const { width } = getViewport();
  const colW = Math.min(width - MARGIN * 2, MAX_COL);
  const colX = Math.round((width - colW) / 2);

  let y = TOP;
  return rows.map((row) => {
    const descLines = row.description
      ? wrapText(ctx, row.description, colW, { size: DESC_SIZE })
      : [];
    const descY = y + ROW_PAD + LABEL_SIZE + DESC_GAP;
    const controlY =
      (descLines.length ? descY + descLines.length * DESC_LINE_H : y + ROW_PAD + LABEL_SIZE) +
      CONTROL_GAP;
    const controlW = row.options.length * SEG_W;
    const control = { x: colX + colW - controlW, y: controlY, w: controlW, h: CONTROL_H };
    const rowH = controlY + CONTROL_H + ROW_PAD - y;

    const selectedIndex = Math.max(
      0,
      row.options.findIndex((o) => o.value === row.get()),
    );
    const laid = {
      row,
      colX,
      labelY: y + ROW_PAD,
      descY,
      descLines,
      control,
      selectedIndex,
      segments: segmentRects(control, row.options.length),
    };
    y += rowH + ROW_GAP;
    return laid;
  });
}

/** Draws the settings rows from a layout produced by `layoutSettingsRows`. */
export function drawSettingsRows(ctx, theme, layout) {
  for (const r of layout) {
    drawText(ctx, r.row.label, r.colX, r.labelY, {
      color: theme.text,
      size: LABEL_SIZE,
      weight: '600',
      align: 'left',
      baseline: 'top',
    });
    r.descLines.forEach((line, i) => {
      drawText(ctx, line, r.colX, r.descY + i * DESC_LINE_H, {
        color: theme.textDim,
        size: DESC_SIZE,
        align: 'left',
        baseline: 'top',
      });
    });
    drawSegmentedControl(ctx, theme, {
      ...r.control,
      options: r.row.options.map((o) => o.label),
      selectedIndex: r.selectedIndex,
    });
  }
}

/**
 * Applies a pointerdown to a previously-computed layout: if it landed on a segment, calls that row's
 * set() with the segment's value and returns true. Pure over the layout, so it's unit-testable.
 */
export function handleSettingsRowsInput(layout, event) {
  if (event.type !== 'pointerdown') return false;
  for (const r of layout) {
    for (let i = 0; i < r.segments.length; i++) {
      if (hitTest(r.segments[i], event.x, event.y)) {
        r.row.set(r.row.options[i].value);
        return true;
      }
    }
  }
  return false;
}
