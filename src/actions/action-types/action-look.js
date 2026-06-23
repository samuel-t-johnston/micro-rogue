import { gameLog } from '../../engine/game-log.js';
import { describeTile } from '../../world/describe-tile.js';

/**
 * Examines a tile: writes what the actor perceives there to the log. Logged with the actor as
 * `actor` so the entry always surfaces (see log-visibility.js) even for a remembered or unseen tile.
 * @returns {boolean} Always `true` — examining is a free action and costs no turn, so the turn loop
 *   immediately re-prompts the player.
 */
export function executeLookAt(actor, action, level) {
  gameLog.add({
    actor: actor.id,
    action: 'lookAt',
    pos: { x: action.x, y: action.y },
    display: describeTile(level, actor, { x: action.x, y: action.y }),
  });
  return true;
}
