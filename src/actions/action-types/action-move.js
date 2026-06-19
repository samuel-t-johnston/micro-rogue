import { gameLog } from '../../engine/game-log.js';
import { animations } from '../../render/animations.js';
import { emitSound } from '../../world/sounds.js';
import { rng } from '../../engine/rng.js';

// Validates and executes a move to (action.x, action.y).
// Returns false (action consumed a turn) or true (free action — not used here).
export function executeMove(entity, action, level, registry) {
  if (!level.isPassable(action.x, action.y)) return false;

  const from = entity.components.get('position');
  // Capture the origin as primitives before moveEntity mutates the live position
  // component (it's the same object reference) — both the log and the slide need it.
  const origin = from ? { x: from.x, y: from.y } : null;

  // Debug-only entry (no `display`): tracing where each entity went is useful for
  // following AI behavior, but never surfaces in the player-facing log.
  gameLog.add({
    actor: entity.id,
    actorName: entity.components.get('name'),
    action: 'move',
    from: origin,
    to: { x: action.x, y: action.y },
  });

  level.moveEntity(entity, action.x, action.y);
  // Cosmetic only: the slide eases the sprite from its old tile to the new one,
  // which is already its logical position. Fired here (not in moveEntity) so
  // teleports and initial placement, which also go through moveEntity, snap instead.
  animations.slide(entity, origin, { x: action.x, y: action.y });

  // Noisy movers (vermin, clanking armor) sometimes announce themselves: emit a sound at the new
  // tile that hearing creatures — and the player's log — can pick up. The chance roll uses the
  // shared seeded RNG; `registry` is optional so non-action-system callers can skip emission.
  const noisy = entity.components.get('noisyMovement');
  if (noisy && registry && rng.random() < noisy.chance) {
    emitSound(registry, level, {
      sourceId: entity.id,
      x: action.x,
      y: action.y,
      volume: noisy.volume,
      language: null,
      message: noisy.message,
    });
  }
  return false;
}
