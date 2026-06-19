import { resolveSenses } from './senses/sense-registry.js';

/** When multiple senses observe the same entity, keeps the highest-confidence reading. */
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

/**
 * Collects heard sounds across sense results into one list. Sounds are events, not facts to
 * reconcile like entity sightings, so they're concatenated — deduped by the sound entity's id in
 * case multiple hearing-type senses report the same sound.
 */
function mergeSounds(rawResults) {
  const bySoundId = new Map();
  for (const result of rawResults) {
    for (const sound of result.sounds ?? []) {
      if (!bySoundId.has(sound.soundId)) bySoundId.set(sound.soundId, sound);
    }
  }
  return [...bySoundId.values()];
}

/** Collects heard scents across sense results, keeping the strongest reading per profile. */
function mergeSmells(rawResults) {
  const byProfile = new Map();
  for (const result of rawResults) {
    for (const smell of result.smells ?? []) {
      const existing = byProfile.get(smell.profile);
      if (!existing || smell.intensity > existing.intensity) byProfile.set(smell.profile, smell);
    }
  }
  return [...byProfile.values()];
}

// Runs all senses for an entity and updates its tilePerception component.
// Called by buildPlanningContext each turn and directly for initial FOV setup.
export function applySenses(entity, level, turnCount = 0) {
  const senseNames = entity.components.get('senses') ?? [];
  const tilePerception = entity.components.get('tilePerception');
  const rawResults = resolveSenses(senseNames).map(sense => sense(entity, level, turnCount));

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

/**
 * Runs all senses, updates tilePerception, and returns the context object
 * passed to each goal's evaluate(). Called once per entity turn.
 */
export function buildPlanningContext({ entity, level, inputController, turnCount }) {
  const memory = entity.components.get('memory');
  const pos = entity.components.get('position');
  const tilePerception = entity.components.get('tilePerception');

  const { rawResults, currentVisible } = applySenses(entity, level, turnCount);

  return {
    memory,
    selfState: {
      position: { x: pos.x, y: pos.y },
      factions: entity.components.get('faction') ?? [],
    },
    perception: {
      entities: mergeSenseResults(rawResults),
      sounds: mergeSounds(rawResults),
      smells: mergeSmells(rawResults),
      visibleTiles: currentVisible,
      knownTiles: tilePerception?.memory ?? new Map(),
    },
    level,
    awaitInput: () => inputController.waitForInput(),
    hasPendingInput: () => inputController.hasPendingInput(),
  };
}
