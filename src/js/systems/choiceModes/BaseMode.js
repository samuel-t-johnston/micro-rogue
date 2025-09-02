// Abstract base class for choice modes
export class BaseMode {
  constructor() {
    this.validKeys = [];
  }

  /**
   * Handle input for this mode
   * @param {string} key - The key that was pressed
   * @param {Object} context - The action context (e.g., { action: 'pickup', items: [...] })
   * @param {Object} gameState - The current game state
   * @param {Object} gameDisplay - The game display element
   * @param {Object} gameActions - Available game actions
   * @param {Object} modeManager - The choice mode manager instance
   * @returns {boolean} - Whether the input was handled successfully
   */
  handleInput(key, context, gameState, gameDisplay, gameActions, modeManager) {
    throw new Error('handleInput must be implemented by subclass');
  }

  /**
   * Get display text for this mode
   * @param {Object} context - The action context
   * @returns {string|null} - Display text or null if no display text
   */
  getDisplayText(context) {
    return null;
  }

  /**
   * Check if a key is valid for this mode
   * @param {string} key - The key to check
   * @returns {boolean} - Whether the key is valid
   */
  isValidKey(key) {
    return this.validKeys.includes(key.toLowerCase());
  }
}
