// Sense that reveals the full world state — all entities and their positions.
// Confidence is always 100; no FOV or light gating. visibleTiles is empty
// because mega-vision bypasses tile-level perception entirely.
export function megaVision(entity, level, turnCount) {
  const entities = [];
  for (const e of level.entities) {
    if (e === entity) continue;
    const pos = e.components.get('position');
    if (!pos) continue;
    entities.push({
      entityId: e.id,
      position: { x: pos.x, y: pos.y },
      confidence: 100,
      turnObserved: turnCount,
      tags: {
        isEnemy: e.components.has('turnTaker') && !e.components.has('playerControlled'),
        isPlayer: e.components.has('playerControlled'),
      },
    });
  }
  return { entities, visibleTiles: new Set() };
}
