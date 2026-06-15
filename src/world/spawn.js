// Resolves where the player arrives on a level: the entity tagged `entryPoint`. The player is
// created and placed by the game scene (not the pipeline), so this reads the marker that generation
// dropped. Falls back to the level centre if nothing is marked. See docs/design/procedural-3x3-dungeon.md.
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
