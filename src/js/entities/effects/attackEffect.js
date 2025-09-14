import { Effect } from '../effect.js';

// Attack Effect - adds to character's attack stat
export class AttackEffect extends Effect {
  constructor(value, source) {
    super('attack_up', value, source, 'offense');
  }

  /**
   * Apply attack bonus to character
   * @param {Character} character - The character to apply the effect to
   */
  applyTo(character) {
    // Add the bonus to the character's bonusedStats
    character.bonusedStats.attack += this.value;
  }

  /**
   * Remove attack bonus from character
   * @param {Character} character - The character to remove the effect from
   */
  removeFrom(character) {
    // Remove the bonus from the character's bonusedStats
    character.bonusedStats.attack -= this.value;
  }
}
