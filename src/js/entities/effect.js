// Base Effect class - all effects inherit from this
export class Effect {
  constructor(type, value, source, category = 'misc', turns = null) {
    this.type = type;
    this.value = value;
    this.source = source;
    this.category = category;
    this.turns = turns; // null for permanent effects, number for temporary
  }

  /**
   * Apply this effect to a character
   * @param {Character} character - The character to apply the effect to
   */
  applyTo(_character) {
    // Override in subclasses
    throw new Error('applyTo method must be implemented by subclass');
  }

  /**
   * Remove this effect from a character
   * @param {Character} character - The character to remove the effect from
   */
  removeFrom(_character) {
    // Override in subclasses
    throw new Error('removeFrom method must be implemented by subclass');
  }

  /**
   * Process each-turn effects (called at the start of each turn)
   * @param {Character} character - The character the effect is applied to
   * @returns {boolean} - true if effect should continue, false if it should be removed
   */
  eachTurn(_character) {
    // Override in subclasses for temporary effects
    return true; // Default: effect continues
  }

  /**
   * Check if this effect equals another (for removal)
   * @param {Effect} other - The other effect to compare
   * @returns {boolean} - true if effects are equal
   */
  equals(other) {
    if (!(other instanceof Effect)) return false;
    return this.type === other.type && 
           this.value === other.value && 
           this.source === other.source;
  }

  /**
   * Get a string representation of this effect
   * @returns {string} - Human-readable effect description
   */
  toString() {
    const turnInfo = this.turns ? ` (${this.turns} turns)` : '';
    return `${this.type}+${this.value} from ${this.source}${turnInfo}`;
  }
}
