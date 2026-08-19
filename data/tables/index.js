/**
 * @file THE catalog of every entity table, keyed by id — the single declared source of truth that
 * `ref(id)` resolves against, mirroring ENTITY_PREFABS for spawnable types. Install it once per entry
 * point with `useTables(TABLES)` (main.js at startup; test setup). As new table groups land
 * (spawn/floor-population tables), import and spread them here.
 */
import { potions, orcLoot, goblinLoot, orcCommanderLoot } from './loot.js';

export const TABLES = {
  potions,
  orcLoot,
  goblinLoot,
  orcCommanderLoot,
};
