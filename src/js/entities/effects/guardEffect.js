import { Effect } from '../effect.js';

// Guard Effect - adds to character's guard stat
export class GuardEffect extends Effect {
  constructor(value, source) {
    super('guard_up', value, source, 'defense');
  }

  /**
   * Apply guard bonus to character
   * @param {Character} character - The character to apply the effect to
   */
  applyTo(character) {
    // Add the bonus to the character's bonusedStats
    character.bonusedStats.guard += this.value;
    
    // Recalculate derived stats (max guard)
    character.calculateMaxGuard();
  }

  /**
   * Remove guard bonus from character
   * @param {Character} character - The character to remove the effect from
   */
  removeFrom(character) {
    // Remove the bonus from the character's bonusedStats
    character.bonusedStats.guard -= this.value;
    
    // Recalculate derived stats (max guard)
    character.calculateMaxGuard();
  }
}
