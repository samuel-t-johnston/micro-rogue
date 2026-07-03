/**
 * @file Attribute registry: resolves attribute names to their definitions and is the extension seam
 * for forks and tests. Populated from the default content set (data/attribute-set.js); call
 * registerAttribute to add or override a definition. Mirrors the sense/goal registries. See
 * docs/design/attribute-system.md.
 */
import { ATTRIBUTE_SET } from '../../data/attribute-set.js';

/**
 * @typedef {object} ResolveContext
 * @property {number} base - The entity's stored base for this attribute, or the definition's `default`.
 * @property {number} mods - Summed equipment attributeModifiers for this attribute.
 * @property {object} entity - The entity being resolved.
 * @property {(name: string) => number} score - Effective value of another score attribute.
 * @property {(name: string) => number} accumulated - Value of an accumulator attribute.
 * @property {(name: string) => {current: number, max: number}} pool - A pool attribute's current/max.
 */

/**
 * @typedef {object} AttributeDefinition
 * @property {string} name - Lowercase kebab-case key.
 * @property {string} flavor - One of Flavors (attribute-flavors.js): score, pool, or accumulator.
 * @property {string} shortLabel - Compact display label (HUD).
 * @property {string} longLabel - Full display label (character screen).
 * @property {number} [default] - Base/value used when an entity has no stored state for this attribute.
 * @property {(ctx: ResolveContext) => number} [resolve] - Score effective value; defaults to base+mods.
 * @property {(ctx: ResolveContext) => number} [resolveMax] - Pool derived maximum (required for pools).
 */

const definitions = new Map();

/** Registers (or overrides) an attribute definition under its `name`. */
export function registerAttribute(definition) {
  definitions.set(definition.name, definition);
}

for (const def of ATTRIBUTE_SET) registerAttribute(def);

/**
 * Resolves an attribute name to its definition.
 * @throws {Error} On an unknown name.
 */
export function getDefinition(name) {
  const def = definitions.get(name);
  if (!def) throw new Error(`Unknown attribute: "${name}"`);
  return def;
}

/** Whether an attribute is registered. */
export function hasDefinition(name) {
  return definitions.has(name);
}

/** All registered definitions, in registration order (used as display order). */
export function allDefinitions() {
  return [...definitions.values()];
}
