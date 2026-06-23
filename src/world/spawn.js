/**
 * Resolves where the player arrives on a level: the entity tagged `entryPoint`. The player is created
 * and placed by the game scene (not the pipeline), so this reads the marker that generation dropped.
 * Falls back to the level centre if nothing is marked. See docs/design/procedural-3x3-dungeon.md.
 */
export function resolveSpawn(registry, level) {
  const entries = registry.getEntitiesWith('entryPoint');
  if (entries.length > 1) {
    console.warn(`[spawn] ${entries.length} entry points found; using the first`);
  }
  const pos = entries[0]?.components.get('position');
  if (pos) return { x: pos.x, y: pos.y };
  console.warn('[spawn] no entryPoint on the level; spawning at centre');
  return { x: Math.floor(level.width / 2), y: Math.floor(level.height / 2) };
}

/**
 * Resolves where the player arrives when entering a level through a transition with the given `port`:
 * the position of the stairs (transition) entity whose `port` matches — you arrive standing on the
 * stairs you'd use to go back. Falls back to resolveSpawn (entryPoint / centre) if no matching port
 * is found. The level's entities must already be placed in `registry`.
 */
export function resolveArrival(registry, level, port) {
  const match = registry.getEntitiesWith('transition')
    .find(e => e.components.get('transition')?.port === port);
  const pos = match?.components.get('position');
  if (pos) return { x: pos.x, y: pos.y };
  console.warn(`[spawn] no transition with port "${port}"; falling back to entry point`);
  return resolveSpawn(registry, level);
}
