import { createVisionSense } from './vision.js';
import { createHearingSense } from './hearing.js';
import { createSmellSense } from './smell.js';
import { megaVision } from './mega-vision.js';

/**
 * @typedef {Object} SenseResult
 * @property {object[]} [entities] - Observed entities: `{ entityId, position, confidence, turnObserved, factions, tags }`.
 * @property {Set<string>} [visibleTiles] - "x,y" keys of tiles the sense reveals (vision-type senses).
 * @property {object[]} [sounds] - Heard sound percepts (hearing-type senses).
 * @property {object[]} [smells] - Smelled scent percepts (smell-type senses).
 */

/**
 * A sense: a filtered world-state query that returns what an entity perceives this turn. Every
 * channel is optional — a sense fills only the ones it produces. See docs/design/ai-architecture.md.
 * @callback Sense
 * @param {object} entity - The perceiving entity.
 * @param {object} level - The current level.
 * @param {number} turnCount - The perceiver's per-entity action clock.
 * @returns {SenseResult}
 */

// Maps the string keys stored in an entity's `senses` component to sense functions.
// The component holds names (not function references) so it serializes cleanly; senses
// are resolved here when perception runs. No sense currently takes per-entity options,
// so a single shared instance per name is sufficient. Add new senses to this map.
const senses = {
  vision: createVisionSense(),    // FOV gated by tile opacity; range from the `vision` component
  hearing: createHearingSense(),  // Sounds only (no entities); range from the `hearing` component
  smell: createSmellSense(),      // Scents only (no entities); threshold from the `smell` component
  'mega-vision': megaVision,      // Full world state, confidence 100, no FOV/light gating
};

/**
 * Registers a sense function under a name, so new senses (or test doubles) can be added without
 * editing this module's literal map.
 * @param {string} name
 * @param {Sense} sense
 */
export function registerSense(name, sense) {
  senses[name] = sense;
}

/**
 * Resolves an ordered list of sense names to sense functions (throws on an unknown name).
 * @param {string[]} names
 * @returns {Sense[]}
 */
export function resolveSenses(names) {
  return names.map(name => {
    const sense = senses[name];
    if (!sense) throw new Error(`Unknown sense: "${name}"`);
    return sense;
  });
}
