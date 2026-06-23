import { drawPanel, drawText, drawButton, hitTest } from './canvas-ui.js';

/**
 * @file Small in-scene overlay shown the moment a run ends — death or victory. It deliberately stays
 * compact and leaves the dungeon visible behind it, giving the player a beat to register what
 * happened before moving on to the full Results screen.
 *
 * Lifecycle mirrors the other game-scene controllers (dialog, character menu): the game scene owns
 * one instance, toggles it with show(outcome)/hide(), and routes render + input to it. onNext fires
 * when the "Next" button is tapped. The outcome ('lose' | 'win') selects the title.
 */
const PANEL_W = 320;
const PANEL_H = 180;
const BUTTON_W = 160;
const BUTTON_H = 52;

const TITLES = { lose: 'You Died', win: 'You Escaped!' };

/** Creates the run-end outcome popup. Toggle with show('lose'|'win')/hide(); `onNext` fires on the button. */
export function createOutcomePopup({ theme, getViewport, onNext }) {
  let visible = false;
  let hover = false;
  let outcome = 'lose';

  function layout() {
    const { width, height } = getViewport();
    const px = Math.round((width - PANEL_W) / 2);
    const py = Math.round((height - PANEL_H) / 2);
    return {
      panel: { x: px, y: py, w: PANEL_W, h: PANEL_H },
      button: {
        x: px + Math.round((PANEL_W - BUTTON_W) / 2),
        y: py + PANEL_H - BUTTON_H - 24,
        w: BUTTON_W,
        h: BUTTON_H,
        label: 'Next',
      },
    };
  }

  return {
    get isVisible() {
      return visible;
    },

    show(result = 'lose') {
      visible = true;
      outcome = result;
    },
    hide() {
      visible = false;
      hover = false;
    },

    render(ctx) {
      if (!visible) return;
      const { width, height } = getViewport();

      // Dim the scene behind the popup so the message reads clearly.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);

      const { panel, button } = layout();
      drawPanel(ctx, theme, panel);

      drawText(ctx, TITLES[outcome] ?? TITLES.lose, panel.x + panel.w / 2, panel.y + 56, {
        color: theme.text,
        size: 36,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      drawButton(ctx, theme, { ...button, hover });
    },

    // Returns true while visible so it swallows all input — the dungeon behind it
    // must not respond to taps once the run has ended.
    handleInput(event) {
      if (!visible) return false;

      const { button } = layout();
      if (event.type === 'pointermove') {
        hover = hitTest(button, event.x, event.y);
        return true;
      }
      if (event.type === 'pointerdown') {
        if (hitTest(button, event.x, event.y)) onNext?.();
        return true;
      }
      if (event.type === 'keydown') {
        if (event.key === 'Enter' || event.key === ' ') onNext?.();
        return true;
      }
      return true;
    },
  };
}
