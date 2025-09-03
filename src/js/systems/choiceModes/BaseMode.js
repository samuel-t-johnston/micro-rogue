// Abstract base class for choice modes
export class BaseMode {
  constructor() {
    this.validKeys = [];
  }

  /**
   * Handle input for this mode
   * @param {string} _key - The key that was pressed
   * @param {Object} _context - The action context (e.g., { action: 'pickup', items: [...] })
   * @param {Object} _gameState - The current game state
   * @param {Object} _gameDisplay - The game display element
   * @param {Object} _gameActions - Available game actions
   * @param {Object} _modeManager - The choice mode manager instance
   * @returns {boolean} - Whether the input was handled successfully
   */
  handleInput(_key, _context, _gameState, _gameDisplay, _gameActions, _modeManager) {
    throw new Error('handleInput must be implemented by subclass');
  }

  /**
   * Get display text for this mode
   * @param {Object} _context - The action context
   * @returns {string|null} - Display text or null if no display text
   */
  getDisplayText(_context) {
    return null;
  }

  /**
   * Get control instructions for this mode
   * @param {Object} _context - The action context
   * @returns {Array} - Array of {label, keys} objects
   */
  getControlInstructions(_context) {
    return [];
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
