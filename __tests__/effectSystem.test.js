// Effect System Tests
import { EffectManager } from '../src/js/systems/effectManager.js';
import { EFFECT_TEMPLATES } from '../src/js/systems/effectRegistry.js';
import { Character } from '../src/js/entities/character.js';
import { HpBonusEffect, GuardEffect, AttackEffect, PoisonEffect } from '../src/js/entities/effects/index.js';

describe('Effect System', () => {
  describe('EffectManager', () => {
    describe('parseEffect', () => {
      test('should parse valid guard effect', () => {
        const result = EffectManager.parseEffect('guard+1');
        expect(result).toEqual({
          name: 'guard_up',
          value: 1,
          template: EFFECT_TEMPLATES.guard_up
        });
      });

      test('should parse valid hp bonus effect', () => {
        const result = EffectManager.parseEffect('hpBonus+5');
        expect(result).toEqual({
          name: 'hp_bonus',
          value: 5,
          template: EFFECT_TEMPLATES.hp_bonus
        });
      });

      test('should parse valid attack effect', () => {
        const result = EffectManager.parseEffect('attack+3');
        expect(result).toEqual({
          name: 'attack_up',
          value: 3,
          template: EFFECT_TEMPLATES.attack_up
        });
      });

      test('should parse poison effect', () => {
        const result = EffectManager.parseEffect('poison+2');
        expect(result).toEqual({
          name: 'poison',
          value: 2,
          template: EFFECT_TEMPLATES.poison
        });
      });

      test('should return null for invalid effect', () => {
        const result = EffectManager.parseEffect('invalid+effect');
        expect(result).toBeNull();
      });

      test('should return null for malformed effect', () => {
        const result = EffectManager.parseEffect('armor++1');
        expect(result).toBeNull();
      });

      test('should return null for empty string', () => {
        const result = EffectManager.parseEffect('');
        expect(result).toBeNull();
      });
    });

    describe('validateEffect', () => {
      test('should validate correct effects', () => {
        expect(EffectManager.validateEffect('guard+1')).toBe(true);
        expect(EffectManager.validateEffect('hpBonus+5')).toBe(true);
        expect(EffectManager.validateEffect('attack+3')).toBe(true);
        expect(EffectManager.validateEffect('poison+2')).toBe(true);
      });

      test('should reject invalid effects', () => {
        expect(EffectManager.validateEffect('invalid+effect')).toBe(false);
        expect(EffectManager.validateEffect('armor++1')).toBe(false);
        expect(EffectManager.validateEffect('')).toBe(false);
        expect(EffectManager.validateEffect('armor-1')).toBe(false);
      });
    });

    describe('applyEffect and removeEffect', () => {
      let character;

      beforeEach(() => {
        character = new Character();
      });

      test('should apply hp bonus effect', () => {
        const initialHpBonus = character.bonusedStats.hpBonus;
        EffectManager.applyEffect(character, 'hpBonus+3', 'equipment');
        
        expect(character.bonusedStats.hpBonus).toBe(initialHpBonus + 3);
        expect(character.effects).toHaveLength(1);
        expect(character.effects[0]).toBeInstanceOf(HpBonusEffect);
        expect(character.effects[0].type).toBe('hp_bonus');
        expect(character.effects[0].value).toBe(3);
        expect(character.effects[0].source).toBe('equipment');
        expect(character.effects[0].category).toBe('health');
      });

      test('should remove hp bonus effect', () => {
        // Apply effect first
        EffectManager.applyEffect(character, 'hpBonus+3', 'equipment');
        const hpBonusWithEffect = character.bonusedStats.hpBonus;
        
        // Remove effect
        EffectManager.removeEffect(character, 'hpBonus+3', 'equipment');
        
        expect(character.bonusedStats.hpBonus).toBe(hpBonusWithEffect - 3);
        expect(character.effects).toHaveLength(0);
      });

      test('should handle multiple effects from different sources', () => {
        EffectManager.applyEffect(character, 'hpBonus+2', 'equipment');
        EffectManager.applyEffect(character, 'hpBonus+3', 'spell');
        
        expect(character.effects).toHaveLength(2);
        expect(character.bonusedStats.hpBonus).toBe(5); // 0 + 2 + 3
      });

      test('should only remove effects from specified source', () => {
        EffectManager.applyEffect(character, 'hpBonus+2', 'equipment');
        EffectManager.applyEffect(character, 'hpBonus+3', 'spell');
        
        EffectManager.removeEffect(character, 'hpBonus+2', 'equipment');
        
        expect(character.effects).toHaveLength(1);
        expect(character.bonusedStats.hpBonus).toBe(3); // Only spell effect remains
      });

      test('should handle invalid effect gracefully', () => {
        const result = EffectManager.applyEffect(character, 'invalid+effect', 'equipment');
        expect(result).toBe(false);
        expect(character.effects).toHaveLength(0);
      });
    });

    describe('getAvailableEffectTypes', () => {
      test('should return all available effect types', () => {
        const types = EffectManager.getAvailableEffectTypes();
        expect(types).toContain('guard_up');
        expect(types).toContain('hp_bonus');
        expect(types).toContain('attack_up');
        expect(types).toContain('poison');
      });
    });

    describe('getEffectTemplate', () => {
      test('should return correct template for valid effect', () => {
        const template = EffectManager.getEffectTemplate('guard_up');
        expect(template).toBe(EFFECT_TEMPLATES.guard_up);
      });

      test('should return null for invalid effect', () => {
        const template = EffectManager.getEffectTemplate('invalid');
        expect(template).toBeNull();
      });
    });
  });

  describe('Character Effect Integration', () => {
    let character;

    beforeEach(() => {
      character = new Character();
    });

    test('should track effects correctly', () => {
      const effect = new HpBonusEffect(5, 'equipment');
      character.addEffect(effect);

      expect(character.effects).toHaveLength(1);
      expect(character.getActiveEffects()).toHaveLength(1);
    });

    test('should recalculate stats when effects change', () => {
      const initialHpBonus = character.bonusedStats.hpBonus;
      
      const effect = new HpBonusEffect(3, 'equipment');
      character.addEffect(effect);

      expect(character.bonusedStats.hpBonus).toBe(initialHpBonus + 3);
    });

    test('should maintain stat consistency', () => {
      const effect = new HpBonusEffect(2, 'equipment');
      character.addEffect(effect);

      // Verify that bonused stats are properly calculated
      expect(character.bonusedStats.hpBonus).toBe(2);
      expect(character.bonusedStats.body).toBe(1); // Base value
    });

    test('should filter effects by category', () => {
      const healthEffect = new HpBonusEffect(2, 'equipment');
      const defenseEffect = new GuardEffect(1, 'equipment');
      
      character.addEffect(healthEffect);
      character.addEffect(defenseEffect);

      const healthEffects = character.getEffectsByCategory('health');
      const defenseEffects = character.getEffectsByCategory('defense');

      expect(healthEffects).toHaveLength(1);
      expect(defenseEffects).toHaveLength(1);
      expect(healthEffects[0].type).toBe('hp_bonus');
      expect(defenseEffects[0].type).toBe('guard_up');
    });

    test('should handle temporary effects with turn counts', () => {
      const poisonEffect = new PoisonEffect(2, 'spell', 3);
      character.addEffect(poisonEffect);

      expect(character.effects[0].turns).toBe(3);

      // Process effects (simulate turn passing)
      character.processEffects();
      expect(character.effects[0].turns).toBe(2);

      character.processEffects();
      expect(character.effects[0].turns).toBe(1);

      character.processEffects();
      expect(character.effects).toHaveLength(0); // Effect should expire
    });
  });
});
