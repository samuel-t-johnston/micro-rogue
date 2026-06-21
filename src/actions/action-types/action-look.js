import { gameLog } from '../../engine/game-log.js';
import { describeTile } from '../../world/describe-tile.js';

// Examine a tile: write what the actor perceives there to the log. A free action (returns true) — it
// costs no turn, so the turn loop immediately re-prompts the player. Logged with the actor as `actor`
// so the entry always surfaces (see log-visibility.js) even for a remembered or unseen tile.
export function executeLookAt(actor, action, level) {
  gameLog.add({
    actor: actor.id,
    action: 'lookAt',
    pos: { x: action.x, y: action.y },
    display: describeTile(level, actor, { x: action.x, y: action.y }),
  });
  return true;
}
