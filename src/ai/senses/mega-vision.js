// Sense that reveals the full world state — all entities and their positions.
// Confidence is always 100; no FOV or light gating.
// Designed to be swapped for a real shadowcast sense later with no planner changes.
export function megaVision(entity, level, turnCount) {
  const results = [];
  for (const e of level.entities) {
    if (e === entity) continue;
    const pos = e.components.get('position');
    if (!pos) continue;
    results.push({
      entityId: e.id,
      position: { x: pos.x, y: pos.y },
      confidence: 100,
      turnObserved: turnCount,
      tags: {
        //This only works from the perspective of the player, but that's the only entity that will have this sense for now, so it's fine. 
        //If we add more entities with this sense later, we'll need to add a way to determine friend vs foe from the perspective of the sensing entity.
        isEnemy: e.components.has('turnTaker') && !e.components.has('playerControlled'),
        isPlayer: e.components.has('playerControlled'),
      },
    });
  }
  return results;
}
