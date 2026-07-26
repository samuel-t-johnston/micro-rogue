/**
 * @file Character menu UI: a card grid. Only in-game functionality should be placed here; game
 * settings, etc. belong in the game menu (game-menu.js).
 */
import { drawText, hitTest } from '../core/canvas-ui.js';
import { createScrollable } from '../core/scrollable.js';

const HEADER_H = 56;
const BACK_BTN_SIZE = 44;
const MARGIN = 16;

const CARD_GAP = 16;
const CARD_MIN_SIZE = 140;
const CARD_GLYPH_SIZE = 48;
const CARD_LABEL_SIZE = 16;

// Returns the back-button rect — shared by all screens (top-left close on root, back on subscreens).
function backButtonRect() {
  return { x: MARGIN, y: MARGIN, w: BACK_BTN_SIZE, h: BACK_BTN_SIZE };
}

// The state-change alert glyph, drawn on the back/exit affordance while an alert is unacknowledged —
// colocating the alert with its remedy (the button that takes you back to see what changed). Red, but
// the '!' carries the meaning so color is never the sole signal (docs/design/state-change-alerts.md).
const ALERT_COLOR = '#e0352f';

function drawHeader(ctx, theme, viewport, title, backGlyph, alerted = false) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const back = backButtonRect();
  ctx.fillStyle = theme.surface;
  ctx.fillRect(back.x, back.y, back.w, back.h);
  drawText(ctx, backGlyph, back.x + back.w / 2, back.y + back.h / 2, {
    color: theme.text,
    size: 22,
    weight: '600',
    align: 'center',
    baseline: 'middle',
  });

  if (alerted) {
    // A badge dot in the button's top-right corner with a '!' — small, unmissable, always in the
    // same place, so glancing at the exit tells you the world changed.
    const bx = back.x + back.w - 8;
    const by = back.y + 8;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = ALERT_COLOR;
    ctx.fill();
    drawText(ctx, '!', bx, by, {
      color: '#fff',
      size: 13,
      weight: '700',
      align: 'center',
      baseline: 'middle',
    });
  }

  drawText(ctx, title, viewport.width / 2, MARGIN + HEADER_H / 2, {
    color: theme.text,
    size: 22,
    weight: '700',
    align: 'center',
    baseline: 'middle',
  });
}

/** Creates the root card grid (Inventory, Equipment cards). Tap a card to navigate; ✕/Escape closes. */
export function createCharacterMenuRoot({
  theme,
  getViewport,
  cards,
  onClose,
  onSelect,
  getAlerted = () => false,
}) {
  function layoutCards() {
    const vp = getViewport();
    const availableW = vp.width - 2 * MARGIN;
    const cols = Math.max(1, Math.floor((availableW + CARD_GAP) / (CARD_MIN_SIZE + CARD_GAP)));
    const cardW = Math.floor((availableW - (cols - 1) * CARD_GAP) / cols);
    const cardH = cardW;
    const rows = Math.ceil(cards.length / cols);
    const gridH = rows * cardH + (rows - 1) * CARD_GAP;
    const gridStartY =
      MARGIN +
      HEADER_H +
      MARGIN +
      Math.max(0, Math.floor((vp.height - HEADER_H - 3 * MARGIN - gridH) / 2));

    return cards.map((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        ...card,
        x: MARGIN + col * (cardW + CARD_GAP),
        y: gridStartY + row * (cardH + CARD_GAP),
        w: cardW,
        h: cardH,
      };
    });
  }

  return {
    render(ctx) {
      const vp = getViewport();
      drawHeader(ctx, theme, vp, 'Character', '✕', getAlerted()); // ✕ close

      for (const card of layoutCards()) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(card.x, card.y, card.w, card.h);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 1;
        ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);

        const cx = card.x + card.w / 2;
        const cy = card.y + card.h / 2 - 12;
        drawText(ctx, card.glyph, cx, cy, {
          color: theme.text,
          size: CARD_GLYPH_SIZE,
          align: 'center',
          baseline: 'middle',
        });
        drawText(ctx, card.label, cx, card.y + card.h - 18, {
          color: theme.text,
          size: CARD_LABEL_SIZE,
          weight: '600',
          align: 'center',
          baseline: 'middle',
        });
        if (card.badge) {
          drawText(ctx, card.badge, cx, card.y + card.h - 38, {
            color: theme.textDim,
            size: 12,
            align: 'center',
            baseline: 'middle',
          });
        }
      }
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        onClose();
        return true;
      }
      if (event.type !== 'pointerdown') return event.type === 'pointermove';

      if (hitTest(backButtonRect(), event.x, event.y)) {
        onClose();
        return true;
      }

      for (const card of layoutCards()) {
        if (hitTest(card, event.x, event.y)) {
          onSelect(card.id);
          return true;
        }
      }
      return true; // consume all input while menu is open
    },
  };
}

/**
 * Wraps a scrollable screen `body` in the consistent header + back chrome. The header stays fixed;
 * the body scrolls within the region below it when its content overflows (a scrollbar appears only
 * then). The body is an object with:
 *   renderContent(ctx, rect) → contentHeight  (draws the scrollable content; `rect.y` may be above
 *                                               the region when scrolled; returns its pixel height)
 *   handleInput(event, rect) → handled        (hit-tests against the same rect)
 *   hasOverlay?() → boolean                   (a full-screen sub-menu is up: it's modal and unclipped)
 *   renderOverlay?(ctx)                        (draws that sub-menu on top of the scroll region)
 */
export function createCharacterMenuSubScreen({
  theme,
  getViewport,
  title,
  body,
  onBack,
  getAlerted = () => false,
}) {
  const scroller = createScrollable();
  let contentH = 0;

  function bodyRect() {
    const vp = getViewport();
    const top = MARGIN + HEADER_H + MARGIN;
    return { x: MARGIN, y: top, w: vp.width - 2 * MARGIN, h: vp.height - top - MARGIN };
  }

  // The rect the body draws/hit-tests against: same column, top shifted up by the scroll offset so
  // content at content-y 0 lands at region.y - scroll.
  function contentRect(region, scroll) {
    return { x: region.x, y: region.y - scroll, w: region.w, h: region.h };
  }

  return {
    render(ctx) {
      const vp = getViewport();
      drawHeader(ctx, theme, vp, title, '‹', getAlerted()); // ‹ back
      const region = bodyRect();
      scroller.render(ctx, {
        theme,
        region,
        contentH,
        drawContent: (c, scroll) => {
          contentH = body.renderContent(c, contentRect(region, scroll));
        },
      });
      body.renderOverlay?.(ctx); // full-screen sub-menus draw on top, outside the scroll clip
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        onBack();
        return true;
      }
      if (event.type === 'pointerdown' && hitTest(backButtonRect(), event.x, event.y)) {
        onBack();
        return true;
      }
      // A full-screen sub-menu is modal: forward raw events straight to it, bypassing the scroller.
      if (body.hasOverlay?.()) return body.handleInput(event, bodyRect());

      const region = bodyRect();
      const { tap } = scroller.handleInput(event, { region, contentH });
      if (tap) {
        return body.handleInput(
          { type: 'pointerdown', x: tap.x, y: tap.y },
          contentRect(region, scroller.scroll),
        );
      }
      return event.type === 'pointerdown' || event.type === 'pointermove';
    },
  };
}
