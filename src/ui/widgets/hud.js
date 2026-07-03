import { drawPanel, drawText } from '../core/canvas-ui.js';
import { Anchor, resolveAnchor, applyHandedness } from '../core/anchor-system.js';
import { gameSettings } from '../../engine/config/settings.js';

const MARGIN = 12;
const ANCHOR = Anchor.TOP_LEFT;

const BOX = 46; // level box side
const GAP = 8; // between the box and the stat lines
const LINE_H = 15;

/**
 * Creates the HUD widget: a level box in the corner with HP/MP/EXP stat lines beside it, anchored
 * top-left (mirrored to top-right for left-handedness — the box hugs the corner either way and the
 * lines read inward). EXP shows progress within the current level (into / span to next).
 */
export function createHudWidget({ theme, getViewport }) {
  return {
    render(ctx, state) {
      const vp = getViewport();
      const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
      const { x, y } = resolveAnchor(anchor, vp);
      const { level, hp, mp, exp } = state;

      const right = x === vp.width; // mirrored to the right edge
      const top = y + MARGIN;

      // Level box in the corner: surface fill, primary border, level number in the normal text color.
      const boxX = right ? x - MARGIN - BOX : x + MARGIN;
      drawPanel(ctx, theme, { x: boxX, y: top, w: BOX, h: BOX });
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 0.5, top + 0.5, BOX - 1, BOX - 1);
      drawText(ctx, `${level}`, boxX + BOX / 2, top + BOX / 2, {
        color: theme.text,
        size: 26,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      // Stat lines beside the box: HP over MP over EXP, each in its stat color.
      const textX = right ? boxX - GAP : boxX + BOX + GAP;
      const align = right ? 'right' : 'left';
      const lines = [
        { text: `HP: ${hp.current}/${hp.max}`, color: theme.health },
        { text: `MP: ${mp.current}/${mp.max}`, color: theme.magic },
        { text: `EXP: ${exp.into}/${exp.forNext}`, color: theme.experience },
      ];
      lines.forEach((line, i) => {
        drawText(ctx, line.text, textX, top + 3 + i * LINE_H, {
          color: line.color,
          size: 13,
          weight: '600',
          align,
        });
      });
    },
  };
}
