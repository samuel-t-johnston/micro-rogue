import { drawText } from '../core/canvas-ui.js';
import { Flavors } from '../../attributes/attribute-flavors.js';

const ROW_H = 40;
const ROW_GAP = 4;
const PADDING = 14;

/**
 * Creates the stats screen body: a read-only list of the player's attributes, one row each — label on
 * the left, value on the right. `getAttributes` yields resolved views (describeAttribute output), so
 * this stays a pure renderer that knows nothing of the attribute set: a pool shows current/max, a score
 * or accumulator shows a single value. Read-only, so it consumes no input; the sub-screen chrome owns Back.
 */
export function createStatsScreenBody({ theme, getAttributes }) {
  const valueText = (attr) =>
    attr.flavor === Flavors.POOL ? `${attr.current} / ${attr.max}` : `${attr.value}`;

  return {
    render(ctx, body) {
      const attrs = getAttributes();
      if (attrs.length === 0) {
        drawText(ctx, '(no attributes)', body.x + body.w / 2, body.y + ROW_H / 2, {
          color: theme.textDim,
          size: 13,
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      let y = body.y;
      for (const attr of attrs) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(body.x, y, body.w, ROW_H);
        drawText(ctx, attr.longLabel, body.x + PADDING, y + ROW_H / 2, {
          color: theme.textDim,
          size: 13,
          baseline: 'middle',
        });
        drawText(ctx, valueText(attr), body.x + body.w - PADDING, y + ROW_H / 2, {
          color: theme.text,
          size: 16,
          weight: '600',
          align: 'right',
          baseline: 'middle',
        });
        y += ROW_H + ROW_GAP;
      }
    },

    handleInput() {
      return false; // read-only
    },
  };
}
