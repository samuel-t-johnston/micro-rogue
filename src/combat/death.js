// Death handling, triggered from the damage chokepoint (src/effects/effect-damage.js)
// when an entity's HP reaches 0. Centralizing here means melee and consumable damage
// both route death through one place.

// STUB: hook for what a creature leaves behind when it dies — dropping carried items,
// rolling treasure, leaving a corpse entity, death barks, etc. Intentionally empty for
// now; this is the seam to build those on later.
export function onDeath(entity, level, registry) {
  // no-op
}

// Resolves a death: runs the onDeath hook, then removes the entity from the world.
// The turn manager's rescan drops it from the queue automatically on the next pass.
// Player death is stubbed — we leave the entity in place rather than removing it, until
// a real game-over flow exists.
export function handleDeath(entity, level, registry) {
  onDeath(entity, level, registry);

  if (entity.components.has('playerControlled')) {
    // TODO: game-over flow. For now the player simply isn't removed.
    return;
  }

  level.removeEntity(entity);
  registry.destroyEntity(entity);
}
