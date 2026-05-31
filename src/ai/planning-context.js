// Merges results from multiple senses into a single list.
// Where two senses report the same entity, higher confidence wins.
function mergeSenseResults(results) {
  const byEntityId = new Map();
  for (const result of results) {
    const existing = byEntityId.get(result.entityId);
    if (!existing || result.confidence > existing.confidence) {
      byEntityId.set(result.entityId, result);
    }
  }
  return [...byEntityId.values()];
}

export function buildPlanningContext({ entity, level, inputController, turnCount }) {
  const memory = entity.components.get('memory');
  const pos = entity.components.get('position');
  const senses = entity.components.get('senses') ?? [];

  const rawResults = senses.flatMap(sense => sense(entity, level, turnCount));

  return {
    memory,
    selfState: {
      position: { x: pos.x, y: pos.y },
    },
    perception: {
      entities: mergeSenseResults(rawResults),
    },
    level,
    awaitInput: () => inputController.waitForInput(),
    hasPendingInput: () => inputController.hasPendingInput(),
  };
}
