import { drawText } from '../canvas-ui.js';
import { Anchor, resolveAnchor } from '../anchor-system.js';

const MARGIN = 12;

export function createHudWidget({ theme, getViewport }) {
  return {
    render(ctx, state) {
      const { x, y } = resolveAnchor(Anchor.TOP_LEFT, getViewport());
      const { hp, turn } = state;

      drawText(ctx, `HP ${hp.current}/${hp.max}`, x + MARGIN, y + MARGIN, {
        color: theme.text,
        size: 16,
        weight: '600',
      });
      drawText(ctx, `T${turn}`, x + MARGIN, y + MARGIN + 22, {
        color: theme.textDim,
        size: 14,
      });
    },
  };
}
