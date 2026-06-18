import { createVisionSense } from './vision.js';
import { createHearingSense } from './hearing.js';
import { megaVision } from './mega-vision.js';

// Maps the string keys stored in an entity's `senses` component to sense functions.
// The component holds names (not function references) so it serializes cleanly; senses
// are resolved here when perception runs. No sense currently takes per-entity options,
// so a single shared instance per name is sufficient. Add new senses to this map.
const senses = {
  vision: createVisionSense(),    // FOV gated by tile opacity; full detail on what's seen
  hearing: createHearingSense(),  // Sounds only (no entities); range from the `hearing` component
  'mega-vision': megaVision,      // Full world state, confidence 100, no FOV/light gating
};

// Registers a sense function under a name. Lets new senses (or test doubles) be added
// without editing this module's literal map.
export function registerSense(name, sense) {
  senses[name] = sense;
}

// Resolves an ordered list of sense names to sense functions.
export function resolveSenses(names) {
  return names.map(name => {
    const sense = senses[name];
    if (!sense) throw new Error(`Unknown sense: "${name}"`);
    return sense;
  });
}
