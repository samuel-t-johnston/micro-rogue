// Effect Manager - Handles parsing, applying, and removing effects
import { EFFECT_TEMPLATES } from './effectRegistry.js';
import { HpBonusEffect, GuardEffect, AttackEffect, PoisonEffect } from '../entities/effects/index.js';

export class EffectManager {
  /**
   * Parse an effect string using regex templates
   * @param {string} effectString - The effect string to parse (e.g., "guard+1")
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
   * Create an Effect instance from an effect string
   * @param {string} effectString - The effect string to parse (e.g., "guard+1")
   * @param {string} source - The source of the effect (e.g., 'equipment')
   * @returns {Effect|null} - Effect instance or null if invalid
   */
  static createEffect(effectString, source) {
    const parsed = this.parseEffect(effectString);
    if (!parsed) return null;

    const { name, value } = parsed;

    switch (name) {
      case 'hp_bonus':
        return new HpBonusEffect(value, source);
      case 'guard_up':
        return new GuardEffect(value, source);
      case 'attack_up':
        return new AttackEffect(value, source);
      case 'poison':
        return new PoisonEffect(value, source);
      default:
        return null;
    }
  }
  
  /**
   * Apply an effect to a character
   * @param {Character} character - The character to apply the effect to
   * @param {string} effectString - The effect string to apply
   * @param {string} source - The source of the effect (e.g., 'equipment')
   * @returns {boolean} - True if effect was applied successfully
   */
  static applyEffect(character, effectString, source) {
    const effect = this.createEffect(effectString, source);
    if (effect) {
      character.addEffect(effect);
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
    const parsed = this.parseEffect(effectString);
    if (parsed) {
      character.removeEffect(parsed.name, source);
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
