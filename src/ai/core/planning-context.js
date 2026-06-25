import { resolveSenses } from '../senses/sense-registry.js';
import { areHostile } from '../../combat/factions.js';
import { chebyshevDistance, projectTile } from '../../world/map/geometry.js';
import { parseTileKey } from '../../engine/core/tile-key.js';

// An entity is remembered in the fog of war (snapshotted into tilePerception.rememberedEntities) if
// it has any of these components. A list, not a single marker, so a whole class of entities can be
// made rememberable later without touching this code — for now just the `persistVisible` marker.
const REMEMBERABLE_COMPONENTS = ['persistVisible'];

// Records the last-seen appearance of rememberable entities on a now-visible tile into the viewer's
// fog-of-war memory. Replaces (never appends) so a re-seen tile reflects current reality — a changed
// door, or no entry at all once the entity is gone.
function rememberEntities(tilePerception, level, key, x, y) {
  const snapshots = [];
  for (const e of level.getEntitiesAt(x, y)) {
    if (!REMEMBERABLE_COMPONENTS.some((c) => e.components.has(c))) continue;
    const r = e.components.get('renderable');
    if (r)
      snapshots.push({
        sprite: r.sprite,
        color: r.color,
        glyph: r.glyph,
        glyphColor: r.glyphColor,
        layer: r.layer,
      });
  }
  if (snapshots.length > 0) tilePerception.rememberedEntities.set(key, snapshots);
  else tilePerception.rememberedEntities.delete(key);
}

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
  return (
    Array.isArray(sourceFactions) &&
    sourceFactions.length > 0 &&
    !areHostile(selfFactions, sourceFactions)
  );
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
  const seen = perception.entities.filter(
    (o) => o.tags.isActor && areHostile(selfState.factions, o.factions),
  );
  if (seen.length > 0) {
    let nearest = seen[0];
    let best = chebyshevDistance(selfState.position, nearest.position);
    for (const o of seen) {
      const d = chebyshevDistance(selfState.position, o.position);
      if (d < best) {
        nearest = o;
        best = d;
      }
    }
    memory.lastKnownEnemy = { pos: { ...nearest.position }, turn: turnCount, source: 'sight' };
    return;
  }

  // 2. Hearing — the nearest non-ally noise, turned into a tile in the heard direction.
  const heard = (perception.sounds ?? []).filter(
    (s) => s.perceivedDirection && !isConfirmedAlly(selfState.factions, s.sourceFactions),
  );
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

/**
 * Runs all of an entity's senses and updates its `tilePerception` component (the visible set plus
 * tile and remembered-entity memory). Called by buildPlanningContext each turn, and directly for
 * initial FOV setup.
 * @returns {{ rawResults: object[], currentVisible: Set<string> }} The per-sense results and the
 *   union of all visible-tile keys.
 */
export function applySenses(entity, level, turnCount = 0) {
  const senseNames = entity.components.get('senses') ?? [];
  const tilePerception = entity.components.get('tilePerception');
  const rawResults = resolveSenses(senseNames).map((sense) => sense(entity, level, turnCount));

  const currentVisible = new Set();
  for (const result of rawResults) {
    for (const key of result.visibleTiles ?? []) currentVisible.add(key);
  }

  if (tilePerception) {
    tilePerception.visible = currentVisible;
    for (const key of currentVisible) {
      const { x, y } = parseTileKey(key);
      const tileId = level.getTile(x, y);
      if (tileId !== null) tilePerception.memory.set(key, tileId);
      rememberEntities(tilePerception, level, key, x, y);
    }
  }

  return { rawResults, currentVisible };
}

/**
 * @typedef {object} PlanningContext
 * @property {object} memory - The entity's `memory` component (undefined for memoryless entities).
 * @property {{ position: {x: number, y: number}, factions: string[] }} selfState - The acting entity's own state.
 * @property {{ entities: object[], sounds: object[], smells: object[], visibleTiles: Set<string>, knownTiles: Map<string, number> }} perception - Merged, reconciled output of all the entity's senses.
 * @property {object} level - The current level.
 * @property {number} turnCount - The entity's per-entity action clock.
 * @property {() => Promise<object>} awaitInput - Suspends until player input resolves (player goals only).
 * @property {() => boolean} hasPendingInput - True if buffered player input is waiting.
 */

/**
 * Runs all senses, updates tilePerception, and returns the context object passed to each goal's
 * evaluate(). Called once per entity turn.
 * @returns {PlanningContext}
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
