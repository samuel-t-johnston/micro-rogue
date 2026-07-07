import { getPool, adjustPool } from '../../attributes/attribute-access.js';
import { applyEffect, EffectTypes } from '../../effects/core/effects.js';
import { gameLog } from '../../engine/log/game-log.js';
import { rng } from '../../engine/core/rng.js';

/**
 * @file Hunger: the once-per-turn drain on a creature's hunger pool, and the messages that mark the
 * player crossing hunger thresholds or eating. Driven from the game scene's handleTurnEnd for the
 * player only, on turn-consuming actions (not free ones). Any creature *can* carry a hunger pool, but
 * only the player is ticked today. See docs/design/attribute-system.md.
 */

// Fraction-of-max thresholds the downward messages fire at (strictly below), and the fill the "full"
// eat-message needs (at or above). Kept as fractions so they scale with each entity's derived max.
const HUNGRY_PCT = 0.4;
const STARVING_PCT = 0.2;
const STARVE_DAMAGE_CHANCE = 0.5; // odds an empty stomach bites for 1 damage this turn

/** The message for eating (hunger rose this turn), chosen by the fill reached before the same-turn
 *  decay: a full-up gorge reads "stuffed", a decent meal "full", a nibble "less hungry". */
function eatMessage(peak, max) {
  if (peak >= max) return 'You feel stuffed!';
  if (peak >= HUNGRY_PCT * max) return 'You feel full.';
  return 'You feel less hungry.';
}

/** The message for a downward threshold *crossed* this turn (from `before` to `after`), or null if
 *  none was — so sitting below a threshold stays quiet after the one tick that crossed it. */
function crossingMessage(before, after, max) {
  if (before > 0 && after === 0) return 'You are dying of starvation.';
  if (before >= STARVING_PCT * max && after < STARVING_PCT * max) return 'You are starving.';
  if (before >= HUNGRY_PCT * max && after < HUNGRY_PCT * max) return 'You are hungry.';
  return null;
}

function logHunger(player, display) {
  gameLog.add({ actor: player.id, action: 'hunger', display });
}

/**
 * Advances the player's hunger one turn: drain 1 (clamped at 0), announce any threshold crossing or
 * eating, then — on an empty stomach — a 50% bite of 1 damage (which can kill; routed through the
 * damage effect so it dies like any other lethal source).
 *
 * `lastHunger` is the player's hunger at the end of the previous turn; it's how a *crossing* is told
 * from merely sitting below a line, and how *eating* (hunger rose since last turn) is told from the
 * ordinary drain. Returns the new hunger current for the caller to carry as next turn's `lastHunger`.
 * The value is transient scene state, not saved — a reload re-seeds it from the current pool, so a
 * crossing message never re-fires just because the game was reloaded.
 */
export function tickHunger(player, level, registry, lastHunger) {
  const { current: peak, max } = getPool(player, 'hunger');
  const { current: after } = adjustPool(player, 'hunger', -1);

  if (peak > lastHunger) {
    // Hunger rose since last turn → the player ate; judge the message on the pre-decay peak so a
    // gorge-to-full still reads "stuffed" despite this same turn's drain knocking it back by 1.
    logHunger(player, eatMessage(peak, max));
  } else {
    const crossing = crossingMessage(lastHunger, after, max);
    if (crossing) logHunger(player, crossing);
  }

  if (after === 0 && rng.random() < STARVE_DAMAGE_CHANCE) {
    applyEffect(EffectTypes.DAMAGE, player, player, { amount: 1 }, level, registry);
  }

  return after;
}
