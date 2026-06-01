function mergeSenseResults(rawResults) {
  const byEntityId = new Map();
  for (const result of rawResults) {
    for (const obs of result.entities ?? []) {
      const existing = byEntityId.get(obs.entityId);
      if (!existing || obs.confidence > existing.confidence) {
        byEntityId.set(obs.entityId, obs);
      }
    }
  }
  return [...byEntityId.values()];
}

// Runs all senses for an entity and updates its tilePerception component.
// Called by buildPlanningContext each turn and directly for initial FOV setup.
export function applySenses(entity, level, turnCount = 0) {
  const senses = entity.components.get('senses') ?? [];
  const tilePerception = entity.components.get('tilePerception');
  const rawResults = senses.map(sense => sense(entity, level, turnCount));

  const currentVisible = new Set();
  for (const result of rawResults) {
    for (const key of result.visibleTiles ?? []) currentVisible.add(key);
  }

  if (tilePerception) {
    tilePerception.visible = currentVisible;
    for (const key of currentVisible) {
      const [x, y] = key.split(',').map(Number);
      const tileId = level.getTile(x, y);
      if (tileId !== null) tilePerception.memory.set(key, tileId);
    }
  }

  return { rawResults, currentVisible };
}

export function buildPlanningContext({ entity, level, inputController, turnCount }) {
  const memory = entity.components.get('memory');
  const pos = entity.components.get('position');
  const tilePerception = entity.components.get('tilePerception');

  const { rawResults, currentVisible } = applySenses(entity, level, turnCount);

  return {
    memory,
    selfState: {
      position: { x: pos.x, y: pos.y },
    },
    perception: {
      entities: mergeSenseResults(rawResults),
      visibleTiles: currentVisible,
      knownTiles: tilePerception?.memory ?? new Map(),
    },
    level,
    awaitInput: () => inputController.waitForInput(),
    hasPendingInput: () => inputController.hasPendingInput(),
  };
}
