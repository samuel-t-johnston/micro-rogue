import { drawText, hitTest } from '../canvas-ui.js';
import { Anchor, applyHandedness, placeBox } from '../anchor-system.js';
import { gameSettings } from '../../engine/settings.js';

const BUTTON_SIZE = 44;
const MARGIN = 12;
const LINE_HEIGHT = 18;
const LOG_TEXT_SIZE = 14;

// Expanded-overlay layout.
const PANEL_MARGIN = 12;
const PANEL_PAD = 16;
const HEADER_H = 44;
const ROW_H = 22;
const ROW_TEXT_SIZE = 14;
// Keep the body clear of the bottom-left icon, which floats on top of the panel.
const BODY_BOTTOM_RESERVE = BUTTON_SIZE + MARGIN;

const GHOST_LINE_COUNT = 3;

/** The message-log view states the icon cycles through (plus closed). */
export const LogViewState = Object.freeze({
  GHOST: 'ghost',
  EXPANDED: 'expanded',
  DEBUG: 'debug',
});

const STATE_ICON = {
  [LogViewState.GHOST]: '≡',
  [LogViewState.EXPANDED]: '☰',
  [LogViewState.DEBUG]: '{}',
};

/**
 * The icon cycles GHOST → EXPANDED → DEBUG → closed. DEBUG is skipped (EXPANDED
 * closes straight to GHOST) unless debug tooling is enabled.
 */
export function nextLogView(current, debugEnabled) {
  if (current === LogViewState.GHOST) return LogViewState.EXPANDED;
  if (current === LogViewState.EXPANDED) {
    return debugEnabled ? LogViewState.DEBUG : LogViewState.GHOST;
  }
  return LogViewState.GHOST; // DEBUG → closed
}

/** Expanded view: player-facing display strings, all in the normal text color. */
export function visibleLogLines(displayEntries) {
  return displayEntries.map(e => ({ text: e.display, debug: false }));
}

/**
 * Debug view: every entry. A line is flagged `debug` when the player could not perceive
 * it — i.e. it never reaches the message log: no display string, or stamped unseen. Debug
 * lines are both colored (`theme.debug`) and wrapped in braces, so the two cues are
 * redundant — the brace survives where color alone fails (colorblindness, the leading
 * brace stays on screen when a long line is clipped). The braces echo the `{}` mode icon.
 */
export function debugLogLines(allEntries) {
  return allEntries.map(e => {
    const debug = !(e.display != null && e.seen !== false);
    const line = formatDebugEntry(e);
    return { text: debug ? `{${line}}` : line, debug };
  });
}

/**
 * Renders one debug-view line: the turn, then the display string if present, else a
 * compact dump of the entry's structured fields (the cross-cutting turn/seen are
 * shown via the prefix, so they're skipped here).
 */
export function formatDebugEntry(e) {
  const body = e.display != null
    ? e.display
    : Object.entries(e)
        .filter(([k, v]) => k !== 'turn' && k !== 'seen' && k !== 'display' && v != null)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
  return `T${e.turn ?? 0} ${body}`;
}

/** Clamps a scroll offset into the valid range for the given content/viewport heights. */
export function clampScroll(scroll, contentH, viewportH) {
  const max = Math.max(0, contentH - viewportH);
  return Math.min(max, Math.max(0, scroll));
}

/**
 * Bottom-left message log: a few ghost lines plus an icon when closed; a scrollable
 * modal overlay when open. Tapping the icon cycles the view state; the overlay's [✕],
 * a closing tap, or Escape dismisses it.
 *
 * @param {() => Array} getDisplayEntries - player-facing entries (display + seen).
 * @param {() => Array} getAllEntries - every event-log entry (debug view).
 * @param {() => boolean} isDebugEnabled - whether the debug step is reachable.
 */
export function createMessageLogWidget({ theme, getViewport, getDisplayEntries, getAllEntries, isDebugEnabled }) {
  let viewState = LogViewState.GHOST;
  let scroll = 0;
  let drag = null;

  // Bottom-left by default; mirrors to bottom-right when handedness is 'left' (the
  // character-menu button takes the vacated corner). See docs/howto/handedness.md.
  function buttonRect() {
    const anchor = applyHandedness(Anchor.BOTTOM_LEFT, gameSettings.get('handedness'));
    return placeBox(anchor, getViewport(), { w: BUTTON_SIZE, h: BUTTON_SIZE, margin: MARGIN });
  }

  function panelRect() {
    const vp = getViewport();
    return {
      x: PANEL_MARGIN,
      y: PANEL_MARGIN,
      w: vp.width - 2 * PANEL_MARGIN,
      h: vp.height - 2 * PANEL_MARGIN,
    };
  }

  function closeRect() {
    const p = panelRect();
    return { x: p.x + p.w - HEADER_H, y: p.y, w: HEADER_H, h: HEADER_H };
  }

  function bodyRect() {
    const p = panelRect();
    const top = p.y + HEADER_H + 8;
    const bottom = p.y + p.h - BODY_BOTTOM_RESERVE;
    return { x: p.x + PANEL_PAD, y: top, w: p.w - 2 * PANEL_PAD, h: Math.max(0, bottom - top) };
  }

  function currentLines() {
    if (viewState === LogViewState.DEBUG) return debugLogLines(getAllEntries());
    if (viewState === LogViewState.EXPANDED) return visibleLogLines(getDisplayEntries(Infinity));
    return [];
  }

  function contentHeight() {
    return currentLines().length * ROW_H;
  }

  function open(state) {
    viewState = state;
    // Start pinned to the newest entry.
    scroll = clampScroll(Infinity, contentHeight(), bodyRect().h);
  }

  function close() {
    viewState = LogViewState.GHOST;
    scroll = 0;
    drag = null;
  }

  function advance() {
    const next = nextLogView(viewState, isDebugEnabled());
    if (next === LogViewState.GHOST) close();
    else open(next);
  }

  function renderGhostLines(ctx) {
    const lines = getDisplayEntries(GHOST_LINE_COUNT).map(e => e.display);
    const btn = buttonRect();
    // Align the lines to whichever edge the button sits against, so they read inward.
    const rightSide = btn.x > getViewport().width / 2;
    const tx = rightSide ? btn.x + btn.w : btn.x;
    const align = rightSide ? 'right' : 'left';
    // Oldest at top, newest just above the button; alpha steps 0.35 → 0.65.
    const count = lines.length;
    lines.forEach((line, i) => {
      const alpha = count === 1 ? 0.65 : 0.35 + (i / (count - 1)) * 0.30;
      const ly = btn.y - (count - i) * LINE_HEIGHT - 4;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawText(ctx, line, tx, ly, { color: theme.textDim, size: LOG_TEXT_SIZE, align });
      ctx.restore();
    });
  }

  function renderOverlay(ctx) {
    const vp = getViewport();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, vp.width, vp.height);

    const p = panelRect();
    ctx.fillStyle = theme.surface;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);

    const title = viewState === LogViewState.DEBUG ? 'Log — Debug' : 'Log';
    drawText(ctx, title, p.x + PANEL_PAD, p.y + HEADER_H / 2, {
      color: theme.text, size: 16, weight: '700', baseline: 'middle',
    });

    const x = closeRect();
    drawText(ctx, '✕', x.x + x.w / 2, x.y + x.h / 2, {
      color: theme.text, size: 20, weight: '600', align: 'center', baseline: 'middle',
    });

    ctx.fillStyle = theme.primary;
    ctx.fillRect(p.x, p.y + HEADER_H, p.w, 1);

    const body = bodyRect();
    const lines = currentLines();

    if (lines.length === 0) {
      drawText(ctx, 'No messages yet.', body.x, body.y, { color: theme.textDim, size: ROW_TEXT_SIZE });
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x, body.y, body.w, body.h);
    ctx.clip();
    const first = Math.max(0, Math.floor(scroll / ROW_H));
    const last = Math.min(lines.length, Math.ceil((scroll + body.h) / ROW_H));
    for (let i = first; i < last; i++) {
      const { text, debug } = lines[i];
      drawText(ctx, text, body.x, body.y - scroll + i * ROW_H, {
        color: debug ? theme.debug : theme.text,
        size: ROW_TEXT_SIZE,
      });
    }
    ctx.restore();
  }

  function renderButton(ctx) {
    const btn = buttonRect();
    ctx.fillStyle = theme.surface;
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    drawText(ctx, STATE_ICON[viewState], btn.x + btn.w / 2, btn.y + btn.h / 2, {
      color: theme.textDim, size: 18, align: 'center', baseline: 'middle',
    });
  }

  return {
    render(ctx) {
      if (viewState === LogViewState.GHOST) renderGhostLines(ctx);
      else renderOverlay(ctx);
      // The icon draws last so it stays visible (and tappable) over the open overlay.
      renderButton(ctx);
    },

    // Closed: consume taps on the icon (opening the overlay) and nothing else.
    // Open: modal — intercept every event; the icon cycles, [✕]/Escape close, the body scrolls.
    handleInput(event) {
      if (viewState === LogViewState.GHOST) {
        if (event.type === 'pointerdown' && hitTest(buttonRect(), event.x, event.y)) {
          open(LogViewState.EXPANDED);
          return true;
        }
        return false;
      }

      switch (event.type) {
        case 'keydown':
          if (event.key === 'Escape') close();
          return true;
        case 'wheel':
          scroll = clampScroll(scroll + event.deltaY, contentHeight(), bodyRect().h);
          return true;
        case 'pointerdown':
          if (hitTest(buttonRect(), event.x, event.y)) { advance(); return true; }
          if (hitTest(closeRect(), event.x, event.y)) { close(); return true; }
          drag = { y: event.y, scroll };
          return true;
        case 'pointermove':
          if (drag) scroll = clampScroll(drag.scroll + (drag.y - event.y), contentHeight(), bodyRect().h);
          return true;
        case 'pointerup':
        case 'pointercancel':
          drag = null;
          return true;
        default:
          return true;
      }
    },
  };
}
