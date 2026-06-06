// Character menu UI: a card grid
// Only in-game functionality should be placed here.
// Game settings, etc. belong in the game menu (game-menu.js).
import { drawText, hitTest } from './canvas-ui.js';

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

function drawHeader(ctx, theme, viewport, title, backGlyph) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const back = backButtonRect();
  ctx.fillStyle = theme.surface;
  ctx.fillRect(back.x, back.y, back.w, back.h);
  drawText(ctx, backGlyph, back.x + back.w / 2, back.y + back.h / 2, {
    color: theme.text, size: 22, weight: '600', align: 'center', baseline: 'middle',
  });

  drawText(ctx, title, viewport.width / 2, MARGIN + HEADER_H / 2, {
    color: theme.text, size: 22, weight: '700', align: 'center', baseline: 'middle',
  });
}

// Root card grid: shows cards for Inventory and Equipment. Tap a card to navigate.
export function createCharacterMenuRoot({ theme, getViewport, cards, onClose, onSelect }) {
  function layoutCards() {
    const vp = getViewport();
    const availableW = vp.width - 2 * MARGIN;
    const cols = Math.max(1, Math.floor((availableW + CARD_GAP) / (CARD_MIN_SIZE + CARD_GAP)));
    const cardW = Math.floor((availableW - (cols - 1) * CARD_GAP) / cols);
    const cardH = cardW;
    const rows = Math.ceil(cards.length / cols);
    const gridH = rows * cardH + (rows - 1) * CARD_GAP;
    const gridStartY = MARGIN + HEADER_H + MARGIN + Math.max(0, Math.floor((vp.height - HEADER_H - 3 * MARGIN - gridH) / 2));

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
      drawHeader(ctx, theme, vp, 'Character', '✕'); // ✕ close

      for (const card of layoutCards()) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(card.x, card.y, card.w, card.h);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 1;
        ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);

        const cx = card.x + card.w / 2;
        const cy = card.y + card.h / 2 - 12;
        drawText(ctx, card.glyph, cx, cy, {
          color: theme.text, size: CARD_GLYPH_SIZE, align: 'center', baseline: 'middle',
        });
        drawText(ctx, card.label, cx, card.y + card.h - 18, {
          color: theme.text, size: CARD_LABEL_SIZE, weight: '600', align: 'center', baseline: 'middle',
        });
        if (card.badge) {
          drawText(ctx, card.badge, cx, card.y + card.h - 38, {
            color: theme.textDim, size: 12, align: 'center', baseline: 'middle',
          });
        }
      }
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') { onClose(); return true; }
      if (event.type !== 'pointerdown') return event.type === 'pointermove';

      if (hitTest(backButtonRect(), event.x, event.y)) { onClose(); return true; }

      for (const card of layoutCards()) {
        if (hitTest(card, event.x, event.y)) { onSelect(card.id); return true; }
      }
      return true; // consume all input while menu is open
    },
  };
}

// Sub-screens accept a body renderer/handler and provide consistent header + back chrome.
export function createCharacterMenuSubScreen({ theme, getViewport, title, renderBody, handleBodyInput, onBack }) {
  function bodyRect() {
    const vp = getViewport();
    const top = MARGIN + HEADER_H + MARGIN;
    return { x: MARGIN, y: top, w: vp.width - 2 * MARGIN, h: vp.height - top - MARGIN };
  }

  return {
    render(ctx) {
      const vp = getViewport();
      drawHeader(ctx, theme, vp, title, '‹'); // ‹ back
      renderBody(ctx, bodyRect());
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') { onBack(); return true; }
      if (event.type === 'pointerdown' && hitTest(backButtonRect(), event.x, event.y)) {
        onBack(); return true;
      }
      if (handleBodyInput?.(event, bodyRect())) return true;
      return event.type === 'pointerdown' || event.type === 'pointermove';
    },
  };
}
