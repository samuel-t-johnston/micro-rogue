import { Effect } from '../effect.js';

// HP Bonus Effect - adds to character's hpBonus stat
export class HpBonusEffect extends Effect {
  constructor(value, source) {
    super('hp_bonus', value, source, 'health');
  }

  /**
   * Apply HP bonus to character
   * @param {Character} character - The character to apply the effect to
   */
  applyTo(character) {
    // Add the bonus to the character's bonusedStats
    character.bonusedStats.hpBonus += this.value;
    
    // Recalculate derived stats (max HP)
    character.calculateMaxHp();
    
    // Ensure current HP doesn't exceed new max
    if (character.currentHp > character.maxHp) {
      character.currentHp = character.maxHp;
    }
  }

  /**
   * Remove HP bonus from character
   * @param {Character} character - The character to remove the effect from
   */
  removeFrom(character) {
    // Remove the bonus from the character's bonusedStats
    character.bonusedStats.hpBonus -= this.value;
    
    // Recalculate derived stats (max HP)
    character.calculateMaxHp();
    
    // Ensure current HP doesn't exceed new max
    if (character.currentHp > character.maxHp) {
      character.currentHp = character.maxHp;
    }
  }
}
