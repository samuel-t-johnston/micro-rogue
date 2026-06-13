// Save system — the persistence core (M4). Pure snapshot/restore plus the migration-chain
// runner and thin localStorage I/O. No autosave triggers, visibilitychange handling, or UI
// wiring lives here; those build on this foundation in a later phase.
//
// See docs/design/save-system-design.md. Two divergences from that doc, forced by the code:
//   - The serialization unit is the whole entity registry as one flat list (items inside
//     chests/inventories/equipment are entities that live only in the registry), not
//     level.entities. See serialize.js.
//   - The player is serialized inline like any other entity (with a top-level `playerId`
//     pointer), not hoisted to a top-level `player` key — it stays a normal entity.
import { rng } from '../engine/rng.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import {
  serializeEntities,
  deserializeEntities,
  serializeLevel,
  deserializeLevel,
} from './serialize.js';

// Bumped only when the save schema changes in a breaking way (see the design doc). The game
// version is independent and tracks releases; it mirrors package.json.
export const SAVE_VERSION = 2;
export const GAME_VERSION = '0.0.0';

const SAVE_KEY = 'rogue:save';

// Append-only migration chain. Each entry: { from, to, migrate(save) -> save }. Frozen once
// shipped — never edit a released migration.
export const migrations = [
  {
    from: 1,
    to: 2,
    // v1 stored the single gameplay stream as a flat `meta.rngState`. v2 holds a map of named
    // persistent streams (see rng-and-determinism.md); lift the old state into `gameplay`. The
    // stream's continuation is identical — only the envelope changed.
    migrate(save) {
      save.meta.streams = { gameplay: save.meta.rngState };
      delete save.meta.rngState;
      return save;
    },
  },
];

export class SaveTooNewError extends Error {
  constructor(saveVersion, currentVersion) {
    super(`Save version ${saveVersion} is newer than supported version ${currentVersion}`);
    this.name = 'SaveTooNewError';
    this.saveVersion = saveVersion;
    this.currentVersion = currentVersion;
  }
}

export class MigrationError extends Error {
  constructor(from, to, cause) {
    super(`Migration from v${from} to v${to} failed: ${cause?.message ?? cause}`);
    this.name = 'MigrationError';
    this.from = from;
    this.to = to;
    this.cause = cause;
  }
}

// Captures a complete, settled game state into a plain JSON-safe object. Callers pass the
// live pieces explicitly; this module never reaches into game-scene closures.
export function serializeGame({ registry, level, player, turnCount }) {
  const savedAt = new Date().toISOString();
  return {
    saveVersion: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    versionHistory: [{ saveVersion: SAVE_VERSION, gameVersion: GAME_VERSION, savedAt }],
    savedAt,
    meta: {
      ...rng.snapshot(), // { seed (master), streams: { gameplay: state, … } }
      turnCount,
      nextEntityId: registry.getNextId(),
    },
    playerId: player.id,
    currentLevel: serializeLevel(level),
    entities: serializeEntities(registry),
  };
}

// Rebuilds a live game state from a (migrated) save object: restores the RNG to its exact
// position, rehydrates every entity, rebuilds the level, and resolves the player.
export function deserializeGame(save) {
  rng.restore({ seed: save.meta.seed, streams: save.meta.streams });

  const registry = createEntityRegistry();
  deserializeEntities(save.entities, registry);
  // Restore the exact counter last — deserializeEntities only bumped it past restored ids,
  // but the saved value also accounts for ids freed by destroyed entities.
  registry.setNextId(save.meta.nextEntityId);

  const level = deserializeLevel(save.currentLevel, registry);

  const player = registry.getEntity(save.playerId)
    ?? registry.getEntitiesWith('playerControlled')[0]
    ?? null;

  return { registry, level, player, turnCount: save.meta.turnCount };
}

// Runs the migration chain against raw (parsed) save data, upgrading it to the current schema.
// Operates on a deep clone and only returns on full success — a partial migration never leaks.
export function loadSave(raw) {
  if (raw.saveVersion > SAVE_VERSION) {
    throw new SaveTooNewError(raw.saveVersion, SAVE_VERSION);
  }

  let save = structuredClone(raw);

  const applicable = migrations.filter(m => m.from >= save.saveVersion);
  for (const migration of applicable) {
    try {
      save = migration.migrate(save);
      save.saveVersion = migration.to;
      save.versionHistory.push({
        saveVersion: migration.to,
        gameVersion: GAME_VERSION,
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      throw new MigrationError(migration.from, migration.to, err);
    }
  }

  return save;
}

// --- Orchestration: the full save / load round trip for callers ---

// Snapshots a live game and writes it to the single save slot. Thin wrapper so the game
// scene doesn't have to know the serialize-then-write sequence.
export function commitSave({ registry, level, player, turnCount }) {
  writeSave(serializeGame({ registry, level, player, turnCount }));
}

// Reads, migrates, and rehydrates the saved game in one step. Returns the live state
// ({ registry, level, player, turnCount }) or null when there is no save to load.
export function loadSavedGame() {
  const raw = readSave();
  return raw ? deserializeGame(loadSave(raw)) : null;
}

// --- localStorage I/O (single slot, overwritten each save) ---

export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

// Returns the raw parsed save (pre-migration) or null. Callers run loadSave() to migrate.
export function readSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

// Lightweight header for the menu ("Continue" affordance) without rehydrating the whole save.
export function getSaveMeta() {
  const raw = readSave();
  if (!raw) return null;
  return {
    savedAt: raw.savedAt,
    turnCount: raw.meta?.turnCount ?? 0,
    gameVersion: raw.gameVersion,
  };
}
