/**
 * Resolves where the player arrives on a level: the entity tagged `entryPoint`. The player is created
 * and placed by the game scene (not the pipeline), so this reads the marker that generation dropped.
 * Falls back to the nearest walkable tile to the level centre if nothing is marked — never a wall.
 * See docs/design/procedural-3x3-dungeon.md.
 */
export function resolveSpawn(registry, level) {
  const entries = registry.getEntitiesWith('entryPoint');
  if (entries.length > 1) {
    console.warn(`[spawn] ${entries.length} entry points found; using the first`);
  }
  const pos = entries[0]?.components.get('position');
  if (pos) return { x: pos.x, y: pos.y };
  console.warn('[spawn] no entryPoint on the level; spawning at the nearest floor tile to centre');
  return nearestWalkableToCentre(level);
}

/**
 * The last-ditch spawn point: the walkable tile closest to the level centre, found by spiralling out
 * ring by ring. Guarantees a fallback spawn never lands inside a wall (or on a blocking entity, since
 * it defers to `level.isPassable`). Returns the raw centre if the level can't report passability
 * (a bare `{ width, height }` stub) or is wall-solid.
 */
function nearestWalkableToCentre(level) {
  const cx = Math.floor(level.width / 2);
  const cy = Math.floor(level.height / 2);
  if (typeof level.isPassable !== 'function') return { x: cx, y: cy };
  const maxR = Math.max(level.width, level.height);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring perimeter only
        const x = cx + dx;
        const y = cy + dy;
        if (level.isPassable(x, y)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

/**
 * Resolves where the player arrives when entering a level through a transition with the given `port`:
 * the position of the stairs (transition) entity whose `port` matches — you arrive standing on the
 * stairs you'd use to go back. Falls back to resolveSpawn (entryPoint / centre) if no matching port
 * is found. The level's entities must already be placed in `registry`.
 */
export function resolveArrival(registry, level, port) {
  const match = registry
    .getEntitiesWith('transition')
    .find((e) => e.components.get('transition')?.port === port);
  const pos = match?.components.get('position');
  if (pos) return { x: pos.x, y: pos.y };
  console.warn(`[spawn] no transition with port "${port}"; falling back to entry point`);
  return resolveSpawn(registry, level);
}
