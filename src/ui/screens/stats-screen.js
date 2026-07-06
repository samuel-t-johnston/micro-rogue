import { drawText } from '../core/canvas-ui.js';

const PAD = 16;
const GUTTER = 20;
const ROW_GAP = 16;

const LABEL_SIZE = 13;
const BAR_H = 12;
const UNDER_SIZE = 12;
const SCORE_SIZE = 15;
const SCORE_ROW_H = 26;

const LEG = '\u{1F357}'; // poultry leg
const LEG_SIZE = 22;
const HUNGER_LEGS = 5;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// A themed progress bar: surface track, colored fill, primary border.
function drawBar(ctx, theme, { x, y, w, h, fraction, color }) {
  ctx.fillStyle = theme.surface;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp01(fraction), h);
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/**
 * Creates the Character sheet body: a two-column layout — XP/HP/MP bars, a five-drumstick hunger gauge,
 * and the ability scores, split by dividers. `getStats` yields a resolved snapshot (assembled by the
 * controller) so this stays a pure renderer. Read-only — the sub-screen chrome owns Back.
 */
export function createStatsScreenBody({ theme, getStats }) {
  // A titled bar with a value line centered beneath it; returns the block's height.
  function labeledBar(ctx, { x, y, w, label, color, fraction, under }) {
    drawText(ctx, label, x, y, { color, size: LABEL_SIZE, weight: '600', baseline: 'top' });
    const barY = y + LABEL_SIZE + 4;
    drawBar(ctx, theme, { x, y: barY, w, h: BAR_H, fraction, color });
    drawText(ctx, under, x + w / 2, barY + BAR_H + 4, {
      color: theme.textDim,
      size: UNDER_SIZE,
      align: 'center',
      baseline: 'top',
    });
    return barY + BAR_H + 4 + UNDER_SIZE - y;
  }

  // Five drumsticks; each past `filled` is dimmed. A leg grays as hunger falls past 80/60/40/20% of max.
  function hungerGauge(ctx, x, y, hunger) {
    const pct = hunger.max ? hunger.current / hunger.max : 0;
    const filled = Math.max(0, Math.min(HUNGER_LEGS, Math.ceil(pct * HUNGER_LEGS)));
    const step = LEG_SIZE + 8;
    for (let i = 0; i < HUNGER_LEGS; i++) {
      ctx.globalAlpha = i < filled ? 1 : 0.2;
      drawText(ctx, LEG, x + i * step, y, { size: LEG_SIZE, baseline: 'top' });
    }
    ctx.globalAlpha = 1;
  }

  function divider(ctx, x, y, w) {
    ctx.fillStyle = theme.primary;
    ctx.fillRect(x, y, w, 1);
  }

  return {
    render(ctx, body) {
      const s = getStats();
      if (!s) return;

      const leftX = body.x + PAD;
      const innerW = body.w - 2 * PAD;
      const colW = (innerW - GUTTER) / 2;
      const rightX = leftX + colW + GUTTER;

      let y = body.y + PAD;

      // Row 1: Level (left) | XP bar (right).
      const xpH = labeledBar(ctx, {
        x: rightX,
        y,
        w: colW,
        label: 'XP:',
        color: theme.experience,
        fraction: s.xp.forNext ? s.xp.into / s.xp.forNext : 0,
        under: `${s.xp.into} / ${s.xp.forNext}`,
      });
      drawText(ctx, `Level: ${s.level}`, leftX, y + xpH / 2, {
        color: theme.text,
        size: 18,
        weight: '700',
        baseline: 'middle',
      });
      y += xpH + ROW_GAP;

      // Row 2: HP bar (left) | MP bar (right).
      const hpH = labeledBar(ctx, {
        x: leftX,
        y,
        w: colW,
        label: 'HP',
        color: theme.health,
        fraction: s.hp.max ? s.hp.current / s.hp.max : 0,
        under: `${s.hp.current} / ${s.hp.max}`,
      });
      labeledBar(ctx, {
        x: rightX,
        y,
        w: colW,
        label: 'MP',
        color: theme.magic,
        fraction: s.mp.max ? s.mp.current / s.mp.max : 0,
        under: `${s.mp.current} / ${s.mp.max}`,
      });
      y += hpH + ROW_GAP;

      // Row 3: hunger gauge.
      drawText(ctx, 'Hunger', leftX, y, {
        color: theme.textDim,
        size: LABEL_SIZE,
        weight: '600',
        baseline: 'top',
      });
      hungerGauge(ctx, leftX, y + LABEL_SIZE + 4, s.hunger);
      y += LABEL_SIZE + 4 + LEG_SIZE + ROW_GAP;

      // Divider, then ability scores in two columns.
      divider(ctx, leftX, y, innerW);
      y += ROW_GAP;

      // A two-column score row; an empty right label leaves that column blank.
      const scoreRow = (labelL, valL, labelR, valR) => {
        drawText(ctx, `${labelL}: ${valL}`, leftX, y, {
          color: theme.text,
          size: SCORE_SIZE,
          baseline: 'top',
        });
        if (labelR) {
          drawText(ctx, `${labelR}: ${valR}`, rightX, y, {
            color: theme.text,
            size: SCORE_SIZE,
            baseline: 'top',
          });
        }
        y += SCORE_ROW_H;
      };
      scoreRow('Strength', s.str, 'Dexterity', s.dex);
      scoreRow('Intelligence', s.int, 'Constitution', s.con);

      // Divider, then Speed, and the resolved Melee | Ranged attack damage.
      y += 4;
      divider(ctx, leftX, y, innerW);
      y += ROW_GAP;
      scoreRow('Speed', s.spd, '', '');
      scoreRow('Melee Atk', s.meleeAttack, 'Ranged Atk', s.rangedAttack);
    },

    handleInput() {
      return false; // read-only
    },
  };
}
