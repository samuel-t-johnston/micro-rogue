/**
 * @file Reusable vertical scrolling for canvas surfaces. `createScrollable` owns the scroll offset and
 * the pointer state, clips content to a region, draws an indicator scrollbar only while the content
 * overflows, and disambiguates a tap (select) from a drag (scroll) using the same slop the map uses
 * for pan-vs-tap. The wrapped body stays a pure renderer: the caller draws it into a scroll-shifted
 * rect (top at `region.y - scroll`) and forwards the tap `handleInput` reports back to the body's own
 * hit-testing against that same shifted layout.
 *
 * Why canvas and not a DOM scroller: the whole UI (map, HUD, menus) is canvas-drawn, and a DOM overlay
 * substrate doesn't exist yet — see docs/design/ui-architecture.md. Repainting a list each frame is
 * negligible on top of the render loop we already run.
 */
import { hitTest } from './canvas-ui.js';

// Matches game-scene.js TAP_SLOP so menus and the map disambiguate tap-vs-drag identically.
const TAP_SLOP = 12;
const SCROLLBAR_W = 6;
const SCROLLBAR_MARGIN = 2;
const SCROLLBAR_MIN_THUMB = 24;

/** Clamps a scroll offset into `[0, max]`, where max leaves the last content pixel at the region foot. */
export function clampScroll(scroll, contentH, regionH) {
  const max = Math.max(0, contentH - regionH);
  return Math.min(max, Math.max(0, scroll));
}

// Draws a slim indicator thumb against the region's right inner edge. Indicator-only: it reflects the
// scroll position but isn't a drag target (the body-drag and wheel are the input paths).
function drawScrollbar(ctx, theme, region, contentH, scroll) {
  const trackH = region.h;
  const thumbH = Math.max(SCROLLBAR_MIN_THUMB, (region.h / contentH) * trackH);
  const maxScroll = contentH - region.h;
  const t = maxScroll > 0 ? clampScroll(scroll, contentH, region.h) / maxScroll : 0;
  const x = region.x + region.w - SCROLLBAR_W - SCROLLBAR_MARGIN;
  const y = region.y + t * (trackH - thumbH);
  ctx.fillStyle = theme.textDim;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x, y, SCROLLBAR_W, thumbH);
  ctx.globalAlpha = 1;
}

/**
 * Creates a scroll controller. Stateless over its inputs otherwise — the caller supplies the current
 * `region` ({x,y,w,h}) and `contentH` on every render/input call, so the geometry can change (viewport
 * resize, content growth) without the controller caching stale values.
 */
export function createScrollable() {
  let scroll = 0;
  let pointer = null; // { startX, startY, startScroll, dragging } between pointerdown and up

  return {
    get scroll() {
      return scroll;
    },

    /** Pins the offset to the content foot — e.g. a log opening on its newest line. */
    pinToBottom(contentH, regionH) {
      scroll = clampScroll(Infinity, contentH, regionH);
    },

    /**
     * Clips to `region`, invokes `drawContent(ctx, scroll)` (content drawn with its top at
     * `region.y - scroll`), then draws the scrollbar when `contentH > region.h`.
     */
    render(ctx, { theme, region, contentH, drawContent }) {
      scroll = clampScroll(scroll, contentH, region.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(region.x, region.y, region.w, region.h);
      ctx.clip();
      drawContent(ctx, scroll);
      ctx.restore();
      if (contentH > region.h) drawScrollbar(ctx, theme, region, contentH, scroll);
    },

    /**
     * Feeds a pointer/wheel event to the scroller, returning `{ tap }` — the press point in screen
     * coordinates when the gesture selected something, else `{ tap: null }`. The caller forwards a tap
     * to its body's hit-testing against a scroll-shifted layout (body top at `region.y - scroll`).
     *
     * When the content fits the region there is nothing to scroll, so a press inside the region is a
     * tap immediately (legacy press-to-select, and no drag can steal it). When it overflows, selection
     * defers to pointerup so a drag past the slop scrolls instead of selecting.
     */
    handleInput(event, { region, contentH }) {
      const canScroll = contentH > region.h;

      switch (event.type) {
        case 'wheel':
          scroll = clampScroll(scroll + event.deltaY, contentH, region.h);
          return { tap: null };

        case 'pointerdown':
          pointer = null;
          // Only claim presses that start inside the scroll region; the caller handles fixed chrome.
          if (!hitTest(region, event.x, event.y)) return { tap: null };
          if (!canScroll) return { tap: { x: event.x, y: event.y } }; // fits → select on press
          pointer = { startX: event.x, startY: event.y, startScroll: scroll, dragging: false };
          return { tap: null };

        case 'pointermove': {
          if (!pointer) return { tap: null };
          if (Math.hypot(event.x - pointer.startX, event.y - pointer.startY) > TAP_SLOP)
            pointer.dragging = true;
          if (pointer.dragging) {
            // Dragging the finger up (event.y < startY) reveals content below, so scroll increases.
            scroll = clampScroll(
              pointer.startScroll + (pointer.startY - event.y),
              contentH,
              region.h,
            );
          }
          return { tap: null };
        }

        case 'pointerup':
        case 'pointercancel': {
          const p = pointer;
          pointer = null;
          if (event.type === 'pointercancel' || !p || p.dragging) return { tap: null };
          return { tap: { x: event.x, y: event.y } }; // overflow → select on release
        }

        default:
          return { tap: null };
      }
    },
  };
}
