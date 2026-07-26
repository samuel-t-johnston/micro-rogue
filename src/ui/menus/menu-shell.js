import { drawText, drawButton, hitTest, wrapText } from '../core/canvas-ui.js';
import { createScrollable } from '../core/scrollable.js';
import {
  layoutSettingsRows,
  drawSettingsRows,
  handleSettingsRowsInput,
} from './settings-controls.js';
import { sfx } from '../../audio/sfx.js';

/**
 * @file Reusable drill-down menu: a centered vertical list of buttons with optional sub-pages.
 * Used by both the main-menu scene and the in-game menu overlay so they share one list/navigation
 * implementation (only the surrounding chrome — branding, backdrop — differs).
 *
 * items come from getItems() (re-read every frame, so live enablement like Continue ↔ hasSave
 * stays current). Each item is either:
 *   { id, label, enabled?, onSelect }                 — an action row
 *   { id, label, enabled?, submenu: { title, items, placeholder } } — drills into a sub-page
 * A sub-page with empty `items` renders its `placeholder` text. A sub-page carrying `rows` instead
 * of `items` is a settings page, rendered as label/description/segmented-control rows (see
 * settings-controls.js) rather than the centered button list. A sub-page carrying `text` instead is
 * a static text page (e.g. Credits), rendered as a centered block of wrapped lines.
 *
 * onClose (optional) marks "overlay mode": the shell dims the scene behind it, shows a ✕ close
 * affordance at the root, and swallows all input (modal). Without it (main-menu scene mode) the
 * caller draws its own background/branding and unhandled taps pass through.
 */
const BUTTON_W = 260;
const BUTTON_H = 56;
const BUTTON_GAP = 16;
const CORNER_BTN = 44;
const MARGIN = 16;
const TEXT_SIZE = 18;
const TEXT_LINE_H = 26;
const TEXT_MAX_COL = 520;
// Top of a sub-page's scroll region — clears the corner button and the title header. Matches the
// settings-rows layout origin so their content isn't double-offset.
const SUBPAGE_TOP = MARGIN + CORNER_BTN + 28;
const SUBPAGE_BOTTOM_PAD = MARGIN; // breathing room below the last row when scrolled to the foot

/** Creates a drill-down menu shell (see the file overview for the item/sub-page shapes and modes). */
export function createMenuShell({ theme, getViewport, getItems, onClose = null }) {
  const pages = []; // sub-page stack; empty === root
  let hoverId = null;
  let settingsLayout = null; // last render's settings-row geometry, reused for hit-testing
  let scroller = createScrollable(); // scrolls the current sub-page's content
  let subContentH = 0; // last render's sub-page content height, reused for scroll clamping/hit-testing

  const isRoot = () => pages.length === 0;

  // A sub-page's scroll region: full width, from below the title header to the bottom margin.
  function subPageRegion() {
    const { width, height } = getViewport();
    return { x: 0, y: SUBPAGE_TOP, w: width, h: height - SUBPAGE_TOP - MARGIN };
  }
  const currentPage = () => (isRoot() ? null : pages[pages.length - 1]);
  const settingsRows = () => currentPage()?.rows ?? null;
  const pageText = () => currentPage()?.text ?? null;
  const currentItems = () => (isRoot() ? getItems() : (pages[pages.length - 1].items ?? []));

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

  function back() {
    pages.pop();
    hoverId = null;
    settingsLayout = null;
    scroller = createScrollable(); // each page scrolls from its own top
  }

  return {
    reset() {
      pages.length = 0;
      hoverId = null;
      settingsLayout = null;
      scroller = createScrollable();
    },

    render(ctx) {
      const { width, height } = getViewport();

      // Sub-pages are reading surfaces (Settings descriptions, Credits) — paint them opaque so the
      // map or main-menu branding behind them can't bleed through and hurt legibility. The root
      // keeps its lighter treatment: a 0.55 dim in overlay mode, nothing in scene mode (the caller
      // owns the background there).
      if (!isRoot()) {
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);
      } else if (onClose) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, width, height);
      }

      const corner = cornerButton();
      if (corner) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(corner.x, corner.y, corner.w, corner.h);
        drawText(ctx, corner.glyph, corner.x + corner.w / 2, corner.y + corner.h / 2, {
          color: theme.text,
          size: 22,
          weight: '600',
          align: 'center',
          baseline: 'middle',
        });
      }

      // Sub-page title header (root branding is the caller's responsibility).
      if (!isRoot()) {
        drawText(ctx, pages[pages.length - 1].title, width / 2, MARGIN + CORNER_BTN / 2, {
          color: theme.text,
          size: 22,
          weight: '700',
          align: 'center',
          baseline: 'middle',
        });
      }

      const rows = settingsRows();
      if (rows) {
        const region = subPageRegion();
        scroller.render(ctx, {
          theme,
          region,
          contentH: subContentH,
          drawContent: (c, scroll) => {
            // The layout is in page-absolute coordinates (its origin is SUBPAGE_TOP === region.y),
            // so a plain translate scrolls it; hit-testing adds the offset back.
            settingsLayout = layoutSettingsRows(c, getViewport, rows);
            const last = settingsLayout.at(-1);
            const bottom = last ? last.control.y + last.control.h : region.y;
            subContentH = bottom - region.y + SUBPAGE_BOTTOM_PAD;
            c.save();
            c.translate(0, -scroll);
            drawSettingsRows(c, theme, settingsLayout);
            c.restore();
          },
        });
        return;
      }

      const text = pageText();
      if (text != null) {
        const region = subPageRegion();
        const colW = Math.min(width - MARGIN * 2, TEXT_MAX_COL);
        const lines = wrapText(ctx, text, colW, { size: TEXT_SIZE });
        subContentH = lines.length * TEXT_LINE_H;
        scroller.render(ctx, {
          theme,
          region,
          contentH: subContentH,
          drawContent: (c, scroll) => {
            // Center the block while it fits; once it overflows, top-align and let it scroll.
            const baseY =
              subContentH <= region.h
                ? region.y + Math.round((region.h - subContentH) / 2)
                : region.y - scroll;
            lines.forEach((line, i) => {
              drawText(c, line, width / 2, baseY + i * TEXT_LINE_H, {
                color: theme.text,
                size: TEXT_SIZE,
                align: 'center',
                baseline: 'top',
              });
            });
          },
        });
        return;
      }

      const rects = buttonRects();
      if (rects.length === 0 && !isRoot()) {
        drawText(ctx, pages[pages.length - 1].placeholder ?? '', width / 2, height / 2, {
          color: theme.textDim,
          size: 16,
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      for (const r of rects) {
        drawButton(ctx, theme, {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          label: r.item.label,
          enabled: r.item.enabled !== false,
          hover: hoverId === r.item.id,
        });
      }
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        if (!isRoot()) {
          back();
          return true;
        }
        if (onClose) {
          onClose();
          return true;
        }
        return false;
      }

      // The corner button (back/close) is fixed chrome: it wins on pointerdown before any scroll or
      // hover handling, on every page.
      if (event.type === 'pointerdown') {
        const corner = cornerButton();
        if (corner && hitTest(corner, event.x, event.y)) {
          sfx.play('menu-select');
          if (isRoot()) onClose();
          else back();
          return true;
        }
      }

      // Scrollable sub-pages: settings rows and text pages route wheel/drag/tap through the scroller.
      // A tap it reports is translated back into page-absolute space before hit-testing the layout.
      if (settingsRows()) {
        const { tap } = scroller.handleInput(event, {
          region: subPageRegion(),
          contentH: subContentH,
        });
        if (
          tap &&
          settingsLayout &&
          handleSettingsRowsInput(settingsLayout, {
            type: 'pointerdown',
            x: tap.x,
            y: tap.y + scroller.scroll,
          })
        ) {
          sfx.play('menu-select');
          return true;
        }
        return onClose !== null; // modal in overlay mode; swallow stray taps
      }
      if (pageText() != null) {
        scroller.handleInput(event, { region: subPageRegion(), contentH: subContentH });
        return onClose !== null; // text pages aren't interactive; just scroll
      }

      // Root / button-list pages: hover on move, select on down.
      if (event.type === 'pointermove') {
        hoverId = null;
        for (const r of buttonRects()) {
          if (r.item.enabled !== false && hitTest(r, event.x, event.y)) {
            hoverId = r.item.id;
            break;
          }
        }
        return false;
      }

      if (event.type !== 'pointerdown') return false;

      for (const r of buttonRects()) {
        if (r.item.enabled === false || !hitTest(r, event.x, event.y)) continue;
        sfx.play('menu-select');
        if (r.item.submenu) {
          pages.push(r.item.submenu);
          scroller = createScrollable(); // the sub-page scrolls from its own top
          hoverId = null;
        } else r.item.onSelect?.();
        return true;
      }

      // Overlay mode is modal: swallow stray taps. Scene mode lets them through.
      return onClose !== null;
    },
  };
}
