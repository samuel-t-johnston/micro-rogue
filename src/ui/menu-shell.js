import { drawText, drawButton, hitTest } from './canvas-ui.js';

// Reusable drill-down menu: a centered vertical list of buttons with optional sub-pages.
// Used by both the main-menu scene and the in-game menu overlay so they share one list/
// navigation implementation (only the surrounding chrome — branding, backdrop — differs).
//
// items come from getItems() (re-read every frame, so live enablement like Continue ↔ hasSave
// stays current). Each item is either:
//   { id, label, enabled?, onSelect }                 — an action row
//   { id, label, enabled?, submenu: { title, items, placeholder } } — drills into a sub-page
// A sub-page with empty `items` renders its `placeholder` text (the Settings placeholder).
//
// onClose (optional) marks "overlay mode": the shell dims the scene behind it, shows a ✕ close
// affordance at the root, and swallows all input (modal). Without it (main-menu scene mode) the
// caller draws its own background/branding and unhandled taps pass through.
const BUTTON_W = 260;
const BUTTON_H = 56;
const BUTTON_GAP = 16;
const CORNER_BTN = 44;
const MARGIN = 16;

export function createMenuShell({ theme, getViewport, getItems, onClose = null }) {
  const pages = [];          // sub-page stack; empty === root
  let hoverId = null;

  const isRoot = () => pages.length === 0;
  const currentItems = () => (isRoot() ? getItems() : pages[pages.length - 1].items);

  // Top-left corner button: ✕ to close at the overlay root, ‹ to go back on a sub-page.
  function cornerButton() {
    if (!isRoot()) return { x: MARGIN, y: MARGIN, w: CORNER_BTN, h: CORNER_BTN, glyph: '‹' };
    if (onClose) return { x: MARGIN, y: MARGIN, w: CORNER_BTN, h: CORNER_BTN, glyph: '✕' };
    return null;
  }

  function buttonRects() {
    const { width, height } = getViewport();
    const items = currentItems();
    const total = items.length * BUTTON_H + Math.max(0, items.length - 1) * BUTTON_GAP;
    const startY = Math.round((height - total) / 2);
    const x = Math.round((width - BUTTON_W) / 2);
    return items.map((item, i) => ({
      item,
      x,
      y: startY + i * (BUTTON_H + BUTTON_GAP),
      w: BUTTON_W,
      h: BUTTON_H,
    }));
  }

  function back() { pages.pop(); hoverId = null; }

  return {
    reset() { pages.length = 0; hoverId = null; },

    render(ctx) {
      const { width, height } = getViewport();

      if (onClose) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, width, height);
      }

      const corner = cornerButton();
      if (corner) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(corner.x, corner.y, corner.w, corner.h);
        drawText(ctx, corner.glyph, corner.x + corner.w / 2, corner.y + corner.h / 2, {
          color: theme.text, size: 22, weight: '600', align: 'center', baseline: 'middle',
        });
      }

      // Sub-page title header (root branding is the caller's responsibility).
      if (!isRoot()) {
        drawText(ctx, pages[pages.length - 1].title, width / 2, MARGIN + CORNER_BTN / 2, {
          color: theme.text, size: 22, weight: '700', align: 'center', baseline: 'middle',
        });
      }

      const rects = buttonRects();
      if (rects.length === 0 && !isRoot()) {
        drawText(ctx, pages[pages.length - 1].placeholder ?? '', width / 2, height / 2, {
          color: theme.textDim, size: 16, align: 'center', baseline: 'middle',
        });
        return;
      }

      for (const r of rects) {
        drawButton(ctx, theme, {
          x: r.x, y: r.y, w: r.w, h: r.h,
          label: r.item.label,
          enabled: r.item.enabled !== false,
          hover: hoverId === r.item.id,
        });
      }
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        if (!isRoot()) { back(); return true; }
        if (onClose) { onClose(); return true; }
        return false;
      }

      if (event.type === 'pointermove') {
        hoverId = null;
        for (const r of buttonRects()) {
          if (r.item.enabled !== false && hitTest(r, event.x, event.y)) { hoverId = r.item.id; break; }
        }
        return false;
      }

      if (event.type !== 'pointerdown') return false;

      const corner = cornerButton();
      if (corner && hitTest(corner, event.x, event.y)) {
        if (isRoot()) onClose(); else back();
        return true;
      }

      for (const r of buttonRects()) {
        if (r.item.enabled === false || !hitTest(r, event.x, event.y)) continue;
        if (r.item.submenu) { pages.push(r.item.submenu); hoverId = null; }
        else r.item.onSelect?.();
        return true;
      }

      // Overlay mode is modal: swallow stray taps. Scene mode lets them through.
      return onClose !== null;
    },
  };
}
