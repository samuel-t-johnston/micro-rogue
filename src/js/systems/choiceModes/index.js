// Export all choice mode classes and utilities
export { BaseMode } from './BaseMode.js';
export { DefaultMode } from './DefaultMode.js';
export { DirectionalMode } from './DirectionalMode.js';
export { NumericMode } from './NumericMode.js';
export { ModeRegistry } from './ModeRegistry.js';

// Create and configure the default mode registry
import { ModeRegistry } from './ModeRegistry.js';
import { DefaultMode } from './DefaultMode.js';
import { DirectionalMode } from './DirectionalMode.js';
import { NumericMode } from './NumericMode.js';

export const defaultModeRegistry = new ModeRegistry();

// Register all the default modes
defaultModeRegistry.register('default', DefaultMode);
defaultModeRegistry.register('directional', DirectionalMode);
defaultModeRegistry.register('numeric', NumericMode);
