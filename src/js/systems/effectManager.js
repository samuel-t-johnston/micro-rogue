// Effect Manager - Handles parsing, applying, and removing effects
import { EFFECT_TEMPLATES } from './effectRegistry.js';

export class EffectManager {
  /**
   * Parse an effect string using regex templates
   * @param {string} effectString - The effect string to parse (e.g., "armor+1")
   * @returns {Object|null} - Parsed effect object or null if invalid
   */
  static parseEffect(effectString) {
    for (const [effectName, template] of Object.entries(EFFECT_TEMPLATES)) {
      const match = effectString.match(template.regex);
      if (match) {
        return {
          name: effectName,
          value: parseInt(match[1]),
          template: template
        };
      }
    }
    return null; // Invalid effect
  }
  
  /**
   * Apply an effect to a character
   * @param {Character} character - The character to apply the effect to
   * @param {string} effectString - The effect string to apply
   * @param {string} source - The source of the effect (e.g., 'equipment')
   * @returns {boolean} - True if effect was applied successfully
   */
  static applyEffect(character, effectString, source) {
    const effect = this.parseEffect(effectString);
    if (effect) {
      effect.template.apply(character, effect.value, source);
      return true;
    }
    return false;
  }
  
  /**
   * Remove an effect from a character
   * @param {Character} character - The character to remove the effect from
   * @param {string} effectString - The effect string to remove
   * @param {string} source - The source of the effect (e.g., 'equipment')
   * @returns {boolean} - True if effect was removed successfully
   */
  static removeEffect(character, effectString, source) {
    const effect = this.parseEffect(effectString);
    if (effect) {
      effect.template.remove(character, effect.value, source);
      return true;
    }
    return false;
  }
  
  /**
   * Validate that an effect string is properly formatted
   * @param {string} effectString - The effect string to validate
   * @returns {boolean} - True if effect is valid
   */
  static validateEffect(effectString) {
    return this.parseEffect(effectString) !== null;
  }
  
  /**
   * Get all available effect types
   * @returns {Array} - Array of effect type names
   */
  static getAvailableEffectTypes() {
    return Object.keys(EFFECT_TEMPLATES);
  }
  
  /**
   * Get effect template by name
   * @param {string} effectName - The name of the effect template
   * @returns {Object|null} - The effect template or null if not found
   */
  static getEffectTemplate(effectName) {
    return EFFECT_TEMPLATES[effectName] || null;
  }
}
