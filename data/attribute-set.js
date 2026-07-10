/**
 * @file Default ROGuE attribute definitions — the content that drives the attribute system. A forking
 * project replaces this module (or calls registerAttribute) to define its own set; that is the whole
 * point of the registry seam. Keys are lowercase kebab-case; display capitalization lives in
 * shortLabel/longLabel.
 *
 * Formulas are pure functions of a resolve context (see AttributeDefinition in
 * src/attributes/attribute-registry.js): `base` (the entity's stored base, or this definition's
 * `default`), `mods` (summed equipment attributeModifiers for this attribute), and score()/
 * accumulated()/pool() to read other attributes. Formulas must stay acyclic.
 *
 * Scale note: the pool max formulas and the level curve are deliberately simple PLACEHOLDERS. Real
 * balance/progression tuning is a separate effort (roadmap: "attributes used in other systems"). See
 * docs/design/attribute-system.md.
 */
import { Flavors } from '../src/attributes/attribute-flavors.js';

// Placeholder level curve: xp to REACH level L is 5·L·(L−1) → 0, 10, 30, 60, 100, … so each level
// costs more than the last. Two directions plus a progress helper for the HUD's EXP readout.

/** The xp threshold to reach `level` (the forward curve). */
export function xpForLevel(level) {
  return 5 * level * (level - 1);
}

/** The level a given xp total has reached — the closed-form inverse of xpForLevel; never below 1. */
export function levelForXp(xp) {
  return Math.floor((5 + Math.sqrt(25 + 20 * xp)) / 10);
}

/**
 * Progress within the current level: `{ level, into, forNext }` — `into` is xp earned past this
 * level's start, `forNext` is the xp span from this level to the next. Drives the HUD's "EXP a/b".
 */
export function levelProgress(xp) {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  return { level, into: xp - base, forNext: xpForLevel(level + 1) - base };
}

// The default score resolver: stored base plus equipment modifiers.
const baseAndMods = ({ base, mods }) => base + mods;

/** Ordered list of the default attribute definitions (registry/display order). */
export const ATTRIBUTE_SET = [
  // Ability scores: stored base + equipment modifiers.
  {
    name: 'str',
    flavor: Flavors.SCORE,
    shortLabel: 'STR',
    longLabel: 'Strength',
    default: 1,
    resolve: baseAndMods,
  },
  {
    name: 'dex',
    flavor: Flavors.SCORE,
    shortLabel: 'DEX',
    longLabel: 'Dexterity',
    default: 1,
    resolve: baseAndMods,
  },
  {
    name: 'int',
    flavor: Flavors.SCORE,
    shortLabel: 'INT',
    longLabel: 'Intelligence',
    default: 1,
    resolve: baseAndMods,
  },
  {
    name: 'con',
    flavor: Flavors.SCORE,
    shortLabel: 'CON',
    longLabel: 'Constitution',
    default: 1,
    resolve: baseAndMods,
  },

  // spd drives turn cadence: it is synced into turnTaker.speed (see src/attributes/speed-sync.js),
  // which the turn manager reads for turn order. Base is on a ~1.0 scale (1.0 = one action per round);
  // DEX adds a small nimbleness bonus (0.01 per point) on top of base + equipment. Formula must stay
  // acyclic — spd reads dex, never the reverse.
  {
    name: 'spd',
    flavor: Flavors.SCORE,
    shortLabel: 'SPD',
    longLabel: 'Speed',
    default: 1,
    resolve: ({ base, mods, score }) => base + mods + 0.01 * score('dex'),
  },

  // attack: the mode-independent damage rating — unarmed/innate base + weapon/equipment `attack`
  // modifiers. The STR/DEX ability scaling is NOT applied here (it depends on the melee-vs-ranged mode
  // of a specific strike, which is an action-time fact); the damage code layers it on via
  // resolveAttackDamage (src/combat/attack-damage.js). Base defaults to 1.
  {
    name: 'attack',
    flavor: Flavors.SCORE,
    shortLabel: 'Atk',
    longLabel: 'Attack',
    default: 1,
    resolve: baseAndMods,
  },

  // level: derived from xp; stores nothing of its own.
  {
    name: 'level',
    flavor: Flavors.SCORE,
    shortLabel: 'Lvl',
    longLabel: 'Level',
    resolve: ({ accumulated }) => levelForXp(accumulated('xp')),
  },

  // Pools: store `current` under the attribute name and a per-entity raw base under the companion
  // `${name}Base` key (e.g. hpBase). `max = base + equipment + 2·stat`: the base is the flat authored
  // floor, equipment adds its `${name}` modifiers, and the governing ability score scales it. An
  // absent current reads as full; an absent base is 0.
  {
    name: 'hp',
    flavor: Flavors.POOL,
    shortLabel: 'HP',
    longLabel: 'Health',
    resolveMax: ({ base, mods, score }) => base + mods + 2 * score('con'),
  },
  {
    name: 'mp',
    flavor: Flavors.POOL,
    shortLabel: 'MP',
    longLabel: 'Mana',
    resolveMax: ({ base, mods, score }) => base + mods + 2 * score('int'),
  },
  {
    name: 'hunger',
    flavor: Flavors.POOL,
    shortLabel: 'Hun',
    longLabel: 'Hunger',
    resolveMax: ({ score }) => score('con') * 20,
  },

  // Accumulators: monotonic, threshold-triggering.
  {
    name: 'xp',
    flavor: Flavors.ACCUMULATOR,
    shortLabel: 'XP',
    longLabel: 'Experience',
    default: 0,
  },
];
