/**
 * @file Item tables: declarative item-generation rules. Today they fill creature inventories (the
 * loadout stage, src/world/generation/stages/stage-loadout.js); the same generators are intended to
 * drive loot drops, chest contents, and floor spawns as the system grows in v0.4.0.
 *
 * A generator is `(rng) => ItemSpec[]`. The current sets are static and ignore `rng`; the parameter is
 * in the signature so a generator can roll random contents later without touching any caller. Each
 * spec is a prefab type id plus an optional quantity (see `item`).
 */

/**
 * One item-spec for a generator: a prefab `type` id and an optional `count`. For a stackable item
 * (arrows, javelins) `count` sets the stack size; for a non-stackable item it's the number of separate
 * copies. Omit `count` to take the prefab's own default — arrows already spawn as a stack of 20, so
 * `item('arrow')` and `item('arrow', 20)` are equivalent.
 * @param {string} type - A prefab id from ENTITY_PREFABS (kind 'item').
 * @param {number} [count] - Stack size (stackable) or copy count (non-stackable).
 */
export const item = (type, count) => ({ type, count });

/** The orc commander's ranged kit: a bow and a quiver of arrows. */
export const orcArcher = () => [item('bow'), item('arrow', 20)];

/** A reach loadout: a single spear (melee lunge at distance 1, a thrust at distance 2). */
export const orcSkirmisher = () => [item('spear')];
