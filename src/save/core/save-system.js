/**
 * @file Save system — the persistence core. Pure snapshot/restore plus the migration-chain
 * runner and thin localStorage I/O. No autosave triggers, visibilitychange handling, or UI
 * wiring lives here; those build on this foundation.
 *
 * See docs/design/save-system-design.md. Two divergences from that doc, forced by the code:
 *   - The serialization unit is the whole entity registry as one flat list (items inside
 *     chests/inventories/equipment are entities that live only in the registry), not
 *     level.entities. See serialize.js.
 *   - The player is serialized inline like any other entity (with a top-level `playerId`
 *     pointer), not hoisted to a top-level `player` key — it stays a normal entity.
 */
import { rng } from '../../engine/core/rng.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import {
  serializeEntities,
  deserializeEntities,
  serializeLevel,
  deserializeLevel,
} from './serialize.js';

/** Save schema version. Bumped only on a breaking schema change (see the design doc). */
export const SAVE_VERSION = 11;

/** Game release version; independent of SAVE_VERSION, tracks releases and mirrors package.json. */
export const GAME_VERSION = '0.3.0';

// Frozen at v5: the combined-sheet (col,row) sprite coordinates that shipped through v4, mapped to
// the catalog names that replaced them (see data/sprites/sprite-catalog.js). Never edit once
// shipped. Coordinates not listed here (e.g. entities that were glyph-only in v4, with sprite:null)
// have no name and become null — they keep rendering as glyphs, which is correct.
const V4_SPRITE_NAMES = {
  '2,0': 'floor',
  '1,5': 'wall',
  '16,16': 'healing-potion',
  '20,16': 'potion-of-pain',
  '19,5': 'dagger',
  '16,12': 'boulder',
  '10,23': 'chest',
  '16,22': 'door-closed',
  '17,22': 'door-open',
};

// v4 sprites were inline { col, row } objects; v5 sprites are catalog name strings. Convert a single
// reference. A name (string) or null passes through; an unknown {col,row} maps to null (the renderer
// then falls back to the glyph). Used by the v4→v5 migration.
const v4SpriteToName = (s) =>
  s && typeof s === 'object' ? (V4_SPRITE_NAMES[`${s.col},${s.row}`] ?? null) : s;

const SAVE_KEY = 'rogue:save';

/**
 * Append-only migration chain. Each entry: `{ from, to, migrate(save) -> save }`. Frozen once
 * shipped — never edit a released migration.
 */
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
  {
    from: 2,
    to: 3,
    // v3 adds multi-floor state: the active floor's transit-map node id and the cold-stored frozen
    // floors. A v2 save is a single-floor game, so it becomes the dungeon's start floor with nothing
    // frozen. The start node id is a frozen literal here — migrations must not depend on the mutable
    // transit map (data/transit-map.js), which can change after this migration ships.
    migrate(save) {
      save.currentNodeId = 'floor-1';
      save.frozenLevels = {};
      return save;
    },
  },
  {
    from: 3,
    to: 4,
    // v4 splits "is a creature/actor" out of the turnTaker component into a dedicated `creature`
    // marker (senses now read isActor from it). Through v3, taking turns was synonymous with being
    // a creature, so every turnTaker entity becomes a creature here — exactly the old semantics.
    // Only the active floor's entities live at the top level (model b); frozen floors carry their
    // own entity lists, so migrate those too.
    migrate(save) {
      const addCreatureToTurnTakers = (entities) => {
        for (const entity of entities ?? []) {
          if (entity.components?.turnTaker && !entity.components.creature) {
            entity.components.creature = {};
          }
        }
      };
      addCreatureToTurnTakers(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        addCreatureToTurnTakers(floor.entities);
      }
      return save;
    },
  },
  {
    from: 4,
    to: 5,
    // v5 moves sprite art into a central catalog: renderables and openable furniture reference a
    // sprite by name instead of carrying inline { col, row } coordinates. Convert the known v4
    // coordinates to names; unknown ones (and the old glyph-only nulls) become null and fall back to
    // glyphs. Fog-of-war snapshots inside tilePerception aren't rewritten — the renderer tolerates an
    // unresolved sprite and falls back, so stale remembered furniture just shows its glyph/color.
    migrate(save) {
      const fixSprites = (entities) => {
        for (const entity of entities ?? []) {
          const r = entity.components?.renderable;
          if (r && 'sprite' in r) r.sprite = v4SpriteToName(r.sprite);
          const o = entity.components?.openable;
          if (o) {
            o.closedSprite = v4SpriteToName(o.closedSprite);
            o.openSprite = v4SpriteToName(o.openSprite);
          }
        }
      };
      fixSprites(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        fixSprites(floor.entities);
      }
      return save;
    },
  },
  {
    from: 5,
    to: 6,
    // v6 adds the throw action: potions gained a `throwable` component (an on-hit effect + a
    // breakChance). Saves through v5 created potions before it existed, so an old thrown potion
    // applied no splash and never broke. Backfill the canonical thrown behavior by item name — the
    // values mirror items.js at v6 and are frozen here. Only potions are throwable-with-effect; every
    // other item is throwable-as-act but carries no component, so it needs no migration.
    migrate(save) {
      const THROWABLE_BY_NAME = {
        'Healing Potion': { effectType: 'heal', params: { amount: 5 }, breakChance: 1 },
        'Potion of Pain': { effectType: 'damage', params: { amount: 5 }, breakChance: 1 },
      };
      const backfill = (entities) => {
        for (const entity of entities ?? []) {
          const spec = THROWABLE_BY_NAME[entity.components?.name];
          if (spec && !entity.components.throwable) {
            entity.components.throwable = { ...spec, params: { ...spec.params } };
          }
        }
      };
      backfill(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        backfill(floor.entities);
      }
      return save;
    },
  },
  {
    from: 6,
    to: 7,
    // v7 makes weapons first-class — a `weapon` component carrying range/ammo — and adds an
    // `ammunition` equipment slot. Saves through v6 predate both: their weapon-slot items have no
    // `weapon` component (the resolver tolerates that as unarmed melee, but we normalize the data so
    // the "every weapon-slot item is a weapon" invariant holds), and their humanoids have no quiver
    // slot, so they could never equip ammo. Backfill both. Frozen string literals on purpose — a
    // migration must never depend on the mutable Slots enum or items.js. See docs/design/ranged-weapons.md.
    migrate(save) {
      const upgrade = (entities) => {
        for (const entity of entities ?? []) {
          const c = entity.components;
          if (!c) continue;
          // 1. A weapon-slot equippable becomes a range-1 melee weapon if it isn't already one.
          if (c.equippable?.slot === 'weapon' && !c.weapon) {
            c.weapon = {
              range: 1,
              meleeRange: 1,
              ammoType: null,
              breakChance: 0,
              attackSprites: {},
            };
          }
          // 2. A humanoid loadout (weapon + armor) gains an empty ammunition slot.
          const slots = c.wearsEquipment?.slots;
          if (slots && 'weapon' in slots && 'armor' in slots && !('ammunition' in slots)) {
            slots.ammunition = null;
          }
        }
      };
      upgrade(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        upgrade(floor.entities);
      }
      return save;
    },
  },
  {
    from: 7,
    to: 8,
    // v8 folds the proto-attributes into one `attributes` component (see docs/design/attribute-system.md).
    // health {current,max} becomes hp (current) + con (=max, the placeholder maxHP=con formula, so the
    // effective max is preserved); attacker {damage} becomes the attack score while attacker stays as a
    // bare "can attack" marker. Item attributeModifiers keys rename to the new lowercase attribute names
    // (attackDamage→attack, HP→hp). Frozen literals on purpose — a migration never depends on live code.
    migrate(save) {
      const fold = (entities) => {
        for (const entity of entities ?? []) {
          const c = entity.components;
          if (!c) continue;
          if (c.health || c.attacker) {
            const attrs = { ...(c.attributes ?? {}) };
            if (c.health) {
              attrs.hp = c.health.current;
              attrs.con = c.health.max;
              delete c.health;
            }
            if (c.attacker) {
              attrs.attack = c.attacker.damage ?? 0;
              c.attacker = {};
            }
            c.attributes = attrs;
          }
          const mods = c.attributeModifiers;
          if (mods) {
            if ('attackDamage' in mods) {
              mods.attack = mods.attackDamage;
              delete mods.attackDamage;
            }
            if ('HP' in mods) {
              mods.hp = mods.HP;
              delete mods.HP;
            }
          }
        }
      };
      fold(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        fold(floor.entities);
      }
      return save;
    },
  },
  {
    from: 8,
    to: 9,
    // v9 makes turn speed a derived attribute. Pre-v9, `spd` was an inert placeholder Score on a ~10
    // scale while the real turn cadence lived in turnTaker.speed; now `spd` (rescaled to a ~1.0 base,
    // plus a small DEX term) is synced *into* turnTaker.speed by the speed sync (src/attributes/
    // speed-sync.js). Seed each entity's new `spd` base straight from its stored turnTaker.speed so its
    // cadence is preserved exactly across the upgrade — the DEX term then layers on at load. Only
    // entities that both take turns and carry attributes are touched; a bare turnTaker keeps its literal
    // speed (no attributes to sync from). Frozen literals only — a migration never calls live code.
    migrate(save) {
      const seedSpd = (entities) => {
        for (const entity of entities ?? []) {
          const c = entity.components;
          if (c?.turnTaker && c.attributes) c.attributes.spd = c.turnTaker.speed;
        }
      };
      seedSpd(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        seedSpd(floor.entities);
      }
      return save;
    },
  },
  {
    from: 9,
    to: 10,
    // v10 splits pool state into a stored current (unchanged, under `hp`) and a per-entity raw base
    // under a companion `${name}Base` key, so the new `max = base + equip + 2·stat` formula no longer
    // double-uses the mutable current value. Pre-v10 there was no HP base and maxHP was just `con`, so
    // seed `hpBase` from the stored `con` — each entity's former max-HP driver — which reproduces the
    // base a freshly-built creature of the same kind now carries (factories author hpBase == con).
    // MP had no authored base and stays baseless (max = 2·int). Frozen literals only — never live code.
    migrate(save) {
      const seedHpBase = (entities) => {
        for (const entity of entities ?? []) {
          const attrs = entity.components?.attributes;
          if (attrs && attrs.hpBase === undefined && ('con' in attrs || 'hp' in attrs)) {
            attrs.hpBase = attrs.con ?? attrs.hp ?? 0;
          }
        }
      };
      seedHpBase(save.entities);
      for (const floor of Object.values(save.frozenLevels ?? {})) {
        seedHpBase(floor.entities);
      }
      return save;
    },
  },
  {
    from: 10,
    to: 11,
    // v11 adds the `levelUp` component that drives on-level-up attribute growth (see
    // src/world/systems/level-up.js). Grant it to the existing player so their save can start leveling;
    // seed the watermark `lastLevel` to the player's CURRENT level so no back-payment of points fires on
    // load — the level derives from xp via the (frozen here) placeholder curve levelForXp(xp) =
    // floor((5+√(25+20·xp))/10). The spec mirrors createPlayer. Only the playerControlled entity gets it;
    // creature spawn-scaling seeds its own specs later. Frozen literals only — a migration never calls
    // live code, so the curve and spec are inlined and stay fixed even if the live ones change.
    migrate(save) {
      for (const entity of save.entities ?? []) {
        const c = entity.components;
        if (!c?.playerControlled || c.levelUp) continue;
        const xp = c.attributes?.xp ?? 0;
        const level = Math.floor((5 + Math.sqrt(25 + 20 * xp)) / 10);
        c.levelUp = {
          dynamic: true,
          points: 1,
          attributePercentages: { str: 0.33, dex: 0.33, con: 0.33, int: 0 },
          maxLevel: 25,
          lastLevel: Math.min(level, 25),
        };
      }
      return save;
    },
  },
];

/** Thrown by loadSave when a save's version is newer than this build supports. */
export class SaveTooNewError extends Error {
  constructor(saveVersion, currentVersion) {
    super(`Save version ${saveVersion} is newer than supported version ${currentVersion}`);
    this.name = 'SaveTooNewError';
    this.saveVersion = saveVersion;
    this.currentVersion = currentVersion;
  }
}

/**
 * Thrown by deserializeGame when a save is structurally intact enough to parse but carries data
 * that would silently corrupt the restored run — currently a missing/non-finite `meta.seed`, which
 * would reseed the RNG master at random and diverge the run forever. Failing loud beats that silent
 * drift; game-scene's onLoadFailed reports it like SaveTooNewError/MigrationError.
 */
export class CorruptSaveError extends Error {
  constructor(reason) {
    super(`Save is corrupt: ${reason}`);
    this.name = 'CorruptSaveError';
    this.reason = reason;
  }
}

/** Thrown by loadSave when a migration step fails; carries the from/to versions and the cause. */
export class MigrationError extends Error {
  constructor(from, to, cause) {
    super(`Migration from v${from} to v${to} failed: ${cause?.message ?? cause}`);
    this.name = 'MigrationError';
    this.from = from;
    this.to = to;
    this.cause = cause;
  }
}

/**
 * Captures a complete, settled game state into a plain JSON-safe object. Callers pass the live
 * pieces explicitly; this module never reaches into game-scene closures. `currentNodeId` +
 * `frozenLevels` come from the level manager's snapshot (the cross-floor state). Under model (b) the
 * registry holds only the active floor + the player, so `entities` is exactly that; each frozen floor
 * carries its own serialized entities inside its blob. See docs/design/map-generation.md and
 * docs/design/save-system-design.md.
 */
export function serializeGame({
  registry,
  level,
  player,
  turnCount,
  currentNodeId = null,
  frozenLevels = {},
}) {
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
    currentNodeId,
    currentLevel: serializeLevel(level),
    frozenLevels,
    entities: serializeEntities(registry),
  };
}

/**
 * Rebuilds a live game state from a (migrated) save object: restores the RNG to its exact position,
 * rehydrates every entity, rebuilds the level, and resolves the player.
 */
export function deserializeGame(save) {
  // Guard the RNG master seed before restore: a missing/non-finite seed would make rng.restore
  // fall back to a fresh random master and silently diverge the run. Fail loud instead (SAVE-1).
  if (!Number.isFinite(save.meta?.seed)) {
    throw new CorruptSaveError('missing or non-finite meta.seed');
  }
  rng.restore({ seed: save.meta.seed, streams: save.meta.streams });

  const registry = createEntityRegistry();
  deserializeEntities(save.entities, registry);
  // Restore the exact counter last — deserializeEntities only bumped it past restored ids,
  // but the saved value also accounts for ids freed by destroyed entities.
  registry.setNextId(save.meta.nextEntityId);

  const level = deserializeLevel(save.currentLevel, registry);

  const player =
    registry.getEntity(save.playerId) ?? registry.getEntitiesWith('playerControlled')[0] ?? null;

  return {
    registry,
    level,
    player,
    turnCount: save.meta.turnCount,
    currentNodeId: save.currentNodeId ?? null,
    frozenLevels: save.frozenLevels ?? {},
  };
}

/**
 * Runs the migration chain against raw (parsed) save data, upgrading it to the current schema.
 * Operates on a deep clone and only returns on full success — a partial migration never leaks.
 * @throws {SaveTooNewError} If the save is newer than this build supports.
 * @throws {MigrationError} If a migration step throws.
 */
export function loadSave(raw) {
  if (raw.saveVersion > SAVE_VERSION) {
    throw new SaveTooNewError(raw.saveVersion, SAVE_VERSION);
  }

  let save = structuredClone(raw);

  const applicable = migrations.filter((m) => m.from >= save.saveVersion);
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

/**
 * Snapshots a live game and writes it to the single save slot. Thin wrapper so the game scene
 * doesn't have to know the serialize-then-write sequence.
 */
export function commitSave({ registry, level, player, turnCount, currentNodeId, frozenLevels }) {
  writeSave(serializeGame({ registry, level, player, turnCount, currentNodeId, frozenLevels }));
}

/**
 * Reads, migrates, and rehydrates the saved game in one step. Returns the live state
 * (`{ registry, level, player, turnCount, … }`) or null when there is no save to load.
 */
export function loadSavedGame() {
  const raw = readSave();
  return raw ? deserializeGame(loadSave(raw)) : null;
}

// --- localStorage I/O (single slot, overwritten each save) ---

/** Writes a save object to the single localStorage slot, overwriting any existing save. */
export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

/** Returns the raw parsed save (pre-migration) or null. Callers run loadSave() to migrate. */
export function readSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Deletes the saved game from the slot. */
export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

/** True if a saved game exists in the slot. */
export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/** Lightweight save header for the menu ("Continue" affordance) without rehydrating the whole save. */
export function getSaveMeta() {
  const raw = readSave();
  if (!raw) return null;
  return {
    savedAt: raw.savedAt,
    turnCount: raw.meta?.turnCount ?? 0,
    gameVersion: raw.gameVersion,
  };
}
