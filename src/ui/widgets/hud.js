import { drawPanel, drawText, hitTest } from '../core/canvas-ui.js';
import { Anchor, resolveAnchor, applyHandedness } from '../core/anchor-system.js';
import { gameSettings } from '../../engine/config/settings.js';

const MARGIN = 12;
const ANCHOR = Anchor.TOP_LEFT;

const BOX = 46; // level box side
const GAP = 8; // between the box and the stat lines
const LINE_H = 15;
const TEXT_W = 100; // stat-line column width (click target + layout only; text isn't clipped)

const STAT_FONT = '600 13px system-ui, sans-serif'; // matches the stat lines, for measuring HP width
const DANGER = '#e0352f'; // alert red for the hunger warning (distinct from the softer HP red)
// The at-a-glance hunger warning shown beside HP, keyed by hungerStatus() (see world/systems/hunger.js).
const HUNGER_LABEL = { hungry: '(Hungry)', starving: '(Starving!)' };

/**
 * Creates the HUD widget: a level box in the corner with HP/MP/EXP stat lines beside it, anchored
 * top-left (mirrored to top-right for left-handedness — the box hugs the corner either way and the
 * lines read inward). EXP shows progress within the current level (into / span to next). Tapping
 * anywhere on the HUD fires `onOpen` (the game scene routes it to the Stats screen).
 */
export function createHudWidget({ theme, getViewport, onOpen }) {
  // Shared geometry so render and hit-testing never drift.
  function layout() {
    const vp = getViewport();
    const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
    const { x, y } = resolveAnchor(anchor, vp);
    const right = x === vp.width; // mirrored to the right edge
    const top = y + MARGIN;
    const boxX = right ? x - MARGIN - BOX : x + MARGIN;
    const textX = right ? boxX - GAP : boxX + BOX + GAP;
    const rectX = right ? boxX - GAP - TEXT_W : boxX;
    return {
      right,
      top,
      boxX,
      textX,
      align: right ? 'right' : 'left',
      rect: { x: rectX, y: top, w: BOX + GAP + TEXT_W, h: BOX },
    };
  }

  return {
    render(ctx, state) {
      const { top, boxX, textX, align, right } = layout();
      const { level, hp, mp, exp, hunger } = state;

      // Level box in the corner: surface fill, primary border, level number in the normal text color.
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
      const hpText = `HP: ${hp.current}/${hp.max}`;
      const lines = [
        { text: hpText, color: theme.health },
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

      // A red "(Hungry)"/"(Starving!)" warning sharing the HP line, just past the HP numbers — so a
      // creeping starvation is visible without opening the Stats screen. Measured off the HP text so it
      // sits beside it on either handedness (to the right left-handed layouts mirror it inward).
      const warn = HUNGER_LABEL[hunger];
      if (warn) {
        ctx.font = STAT_FONT;
        const gap = 6;
        const hpW = ctx.measureText(hpText).width;
        const labelX = right ? textX - hpW - gap : textX + hpW + gap;
        drawText(ctx, warn, labelX, top + 3, { color: DANGER, size: 13, weight: '700', align });
      }
    },

    handleInput(event) {
      if (event.type !== 'pointerdown') return false;
      if (!hitTest(layout().rect, event.x, event.y)) return false;
      onOpen?.();
      return true;
    },
  };
}
