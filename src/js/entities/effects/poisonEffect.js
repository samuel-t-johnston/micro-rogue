import { Effect } from '../effect.js';

// Poison Effect - deals damage each turn for a limited duration
export class PoisonEffect extends Effect {
  constructor(value, source, turns = 5) {
    super('poison', value, source, 'debuff', turns);
  }

  /**
   * Apply poison to character (no immediate effect, just tracking)
   * @param {Character} character - The character to apply the effect to
   */
  applyTo(character) {
    // Poison doesn't modify stats, just tracks the effect
    // The damage is applied each turn via eachTurn()
  }

  /**
   * Remove poison from character (no stat changes to reverse)
   * @param {Character} character - The character to remove the effect from
   */
  removeFrom(character) {
    // Poison doesn't modify stats, so nothing to reverse
  }

  /**
   * Process poison damage each turn
   * @param {Character} character - The character the effect is applied to
   * @returns {boolean} - true if effect should continue, false if it should be removed
   */
  eachTurn(character) {
    // Deal damage
    character.takeDamage(this.value);
    
    // Decrease turn count
    this.turns--;
    
    // Return true if effect should continue (turns > 0)
    return this.turns > 0;
  }
}
