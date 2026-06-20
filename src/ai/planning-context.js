import { resolveSenses } from './senses/sense-registry.js';
import { areHostile } from '../combat/factions.js';
import { chebyshevDistance, projectTile } from '../world/geometry.js';

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

// A source is a "confirmed ally" only if its factions are known AND share a tag with the hearer.
// Unknown/empty factions read as NOT an ally — i.e. worth investigating.
function isConfirmedAlly(selfFactions, sourceFactions) {
  return Array.isArray(sourceFactions) && sourceFactions.length > 0 && !areHostile(selfFactions, sourceFactions);
}

// Selective perception→memory. For entities opted in via `memory.remembersEnemies`, records where a
// foe was last perceived as `memory.lastKnownEnemy = { pos, turn, source }` so the investigate goal
// can pursue it once the trail goes cold. Best source wins: an exact vision sighting beats a heard,
// non-ally noise (turned into a tile in its direction). Updated only on a fresh lead — never cleared
// here; investigate clears it on arrival or staleness. Smell is omitted on purpose: track-scent
// already follows live scent.
function updateEnemyMemory({ memory, selfState, perception, level, turnCount }) {
  if (!memory?.remembersEnemies) return;

  // 1. Vision — the nearest hostile actor's exact tile.
  const seen = perception.entities.filter(o => o.tags.isActor && areHostile(selfState.factions, o.factions));
  if (seen.length > 0) {
    let nearest = seen[0];
    let best = chebyshevDistance(selfState.position, nearest.position);
    for (const o of seen) {
      const d = chebyshevDistance(selfState.position, o.position);
      if (d < best) { nearest = o; best = d; }
    }
    memory.lastKnownEnemy = { pos: { ...nearest.position }, turn: turnCount, source: 'sight' };
    return;
  }

  // 2. Hearing — the nearest non-ally noise, turned into a tile in the heard direction.
  const heard = (perception.sounds ?? []).filter(s =>
    s.perceivedDirection && !isConfirmedAlly(selfState.factions, s.sourceFactions));
  if (heard.length > 0) {
    let nearest = heard[0];
    for (const s of heard) if (s.distance < nearest.distance) nearest = s;
    memory.lastKnownEnemy = {
      pos: projectTile(level, selfState.position, nearest.perceivedDirection, nearest.distance),
      turn: turnCount,
      source: 'hearing',
    };
  }
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

  const selfState = {
    position: { x: pos.x, y: pos.y },
    factions: entity.components.get('faction') ?? [],
  };
  const perception = {
    entities: mergeSenseResults(rawResults),
    sounds: mergeSounds(rawResults),
    smells: mergeSmells(rawResults),
    visibleTiles: currentVisible,
    knownTiles: tilePerception?.memory ?? new Map(),
  };

  updateEnemyMemory({ memory, selfState, perception, level, turnCount });

  return {
    memory,
    selfState,
    perception,
    level,
    turnCount,
    awaitInput: () => inputController.waitForInput(),
    hasPendingInput: () => inputController.hasPendingInput(),
  };
}
