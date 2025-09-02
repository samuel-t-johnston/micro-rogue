// Registry for managing choice mode classes
export class ModeRegistry {
  constructor() {
    this.modes = new Map();
  }

  /**
   * Register a mode class
   * @param {string} name - The mode name
   * @param {Class} modeClass - The mode class constructor
   */
  register(name, modeClass) {
    this.modes.set(name, modeClass);
  }

  /**
   * Get a mode instance by name
   * @param {string} name - The mode name
   * @returns {BaseMode} - A new instance of the mode
   * @throws {Error} - If the mode is not registered
   */
  getMode(name) {
    const ModeClass = this.modes.get(name);
    if (!ModeClass) {
      throw new Error(`Unknown mode: ${name}`);
    }
    return new ModeClass();
  }

  /**
   * Check if a mode is registered
   * @param {string} name - The mode name
   * @returns {boolean} - Whether the mode is registered
   */
  hasMode(name) {
    return this.modes.has(name);
  }

  /**
   * Get all registered mode names
   * @returns {string[]} - Array of registered mode names
   */
  getRegisteredModes() {
    return Array.from(this.modes.keys());
  }
}
