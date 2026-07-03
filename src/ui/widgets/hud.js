import { drawText } from '../core/canvas-ui.js';
import { Anchor, resolveAnchor, applyHandedness } from '../core/anchor-system.js';
import { gameSettings } from '../../engine/config/settings.js';

const MARGIN = 12;
const ANCHOR = Anchor.TOP_LEFT;

/** Creates the HUD widget: HP, level, and turn count, anchored top-left (mirrored for left-handedness). */
export function createHudWidget({ theme, getViewport }) {
  return {
    render(ctx, state) {
      const vp = getViewport();
      const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
      const { x, y } = resolveAnchor(anchor, vp);
      const { hp, level, turn } = state;

      // When mirrored to the right edge the text reads outward off-screen unless it's
      // right-aligned against the edge instead of left-aligned from it.
      const right = x === vp.width;
      const tx = right ? x - MARGIN : x + MARGIN;
      const align = right ? 'right' : 'left';

      drawText(ctx, `HP ${hp.current}/${hp.max}`, tx, y + MARGIN, {
        color: theme.text,
        size: 16,
        weight: '600',
        align,
      });
      drawText(ctx, `Lv ${level}`, tx, y + MARGIN + 22, {
        color: theme.text,
        size: 14,
        weight: '600',
        align,
      });
      drawText(ctx, `T${turn}`, tx, y + MARGIN + 42, {
        color: theme.textDim,
        size: 14,
        align,
      });
    },
  };
}
