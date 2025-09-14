// Effect Registry - Centralized templates for all equipment effects
// Each effect template defines how to parse, apply, and remove effects

export const EFFECT_TEMPLATES = {
  guard_up: {
    regex: /^guard\+(\d+)$/,
    category: 'defense',
    apply: (character, value, source) => {
      character.addEffect({
        type: 'guard_up',
        value: value,
        source: source,
        category: 'defense'
      });
    },
    remove: (character, value, source) => {
      character.removeEffect('guard_up', source);
    },
    eachTurn: null // No ongoing effect
  },
  
  hp_bonus: {
    regex: /^hpBonus\+(\d+)$/,
    category: 'health',
    apply: (character, value, source) => {
      character.addEffect({
        type: 'hp_bonus',
        value: value,
        source: source,
        category: 'health'
      });
    },
    remove: (character, value, source) => {
      character.removeEffect('hp_bonus', source);
    },
    eachTurn: null // No ongoing effect
  },
  
  attack_up: {
    regex: /^attack\+(\d+)$/,
    category: 'offense',
    apply: (character, value, source) => {
      character.addEffect({
        type: 'attack_up',
        value: value,
        source: source,
        category: 'offense'
      });
    },
    remove: (character, value, source) => {
      character.removeEffect('attack_up', source);
    },
    eachTurn: null // No ongoing effect
  },
  
  // Example of a temporary effect with ongoing damage (for future use)
  poison: {
    regex: /^poison\+(\d+)$/,
    category: 'debuff',
    apply: (character, value, source) => {
      character.addEffect({
        type: 'poison',
        value: value,
        source: source,
        category: 'debuff',
        turns: 5 // Lasts 5 turns
      });
    },
    remove: (character, value, source) => {
      character.removeEffect('poison', source);
    },
    eachTurn: (character, value) => {
      character.takeDamage(value);
      return true; // Continue effect
    }
  }
};
