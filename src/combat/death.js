import { gameLog } from '../engine/log/game-log.js';
import { animations } from '../render/animations.js';
import { subject, conjugate } from '../engine/log/text/log-text.js';
import { awardKillXp } from './kill-reward.js';

/**
 * @file Death handling, triggered from the damage chokepoint (src/effects/effect-types/effect-damage.js)
 * when an entity's HP reaches 0. Centralizing here means melee and consumable damage both
 * route death through one place.
 */

/**
 * STUB: hook for what a creature leaves behind when it dies — dropping carried items, rolling
 * treasure, leaving a corpse entity, death barks, etc. Intentionally empty for now; this is the seam
 * to build those on later.
 */
export function onDeath(entity, level, registry) {
  // no-op
}

/**
 * Resolves a death: runs the onDeath hook, then removes the entity from the world. The turn manager's
 * rescan drops it from the queue automatically on the next pass.
 *
 * Player death is special: the entity is intentionally left in place (so the corpse stays visible
 * under the death popup) and the game-over flow is delegated to the level's onPlayerDeath hook, which
 * the game scene wires up. Using the level as the coordination point keeps death.js decoupled from
 * the UI / app-state layers.
 *
 * `killer` is whoever dealt the lethal blow (the damage effect's user), when known; it earns kill XP.
 * Read before any teardown, since the reward scales with the victim's still-live level.
 */
export function handleDeath(entity, level, registry, killer = null) {
  onDeath(entity, level, registry);
  awardKillXp(entity, killer);

  // Logged before any removal — destroyEntity clears the entity's components, so the
  // name and player/non-player distinction must be read while the entity is intact.
  // Snapshot the tile too: the visibility provider anchors this line to where the
  // death happened, independent of the teardown below that strips the position.
  const pos = entity.components.get('position');
  gameLog.add({
    actor: entity.id,
    action: 'death',
    ...(pos && { pos: { x: pos.x, y: pos.y } }),
    display: `${subject(entity)} ${conjugate(entity, 'die', 'dies')}.`,
  });

  if (entity.components.has('playerControlled')) {
    // No smoosh for the player: the corpse is intentionally left in place, visible
    // under the death popup, so fading it out would be wrong. The game-over flow
    // (including clearing the save before the popup) lives in the scene's endGame seam.
    level.onPlayerDeath?.(entity);
    return;
  }

  // Detached smoosh: snapshots the renderable now, before teardown strips it, so the
  // squash keeps drawing after the entity leaves the world on the next line.
  animations.smoosh(entity);
  level.removeEntity(entity);
  registry.destroyEntity(entity);
}
