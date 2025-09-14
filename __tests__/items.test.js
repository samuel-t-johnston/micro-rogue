import itemsData from '../src/data/items/items.json';
import { EffectManager } from '../src/js/systems/effectManager.js';

// Item validation rules and configurations
const ITEM_RULES = {
  // Required properties for all items
  required: ['name', 'symbol'],
  
  // Property-specific rules
  properties: {
    symbol: {
      type: 'string',
      minLength: 1,
      maxLength: 1,
      description: 'Single character symbol for rendering'
    },
    equipment: {
      required: ['slot', 'effect'],
      slot: {
        validValues: ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'neck', 'ring']
      },
      effect: {
        pattern: /^(armor|hpBonus|attack|defense)\+(\d+)$/,
        description: 'armor+X, hpBonus+X, attack+X, or defense+X where X is an integer'
      }
    },
    usable: {
      required: ['use_effect'],
      use_effect: {
        pattern: /^currentHp\+(\d+)$/,
        description: 'currentHp+X where X is an integer'
      }
    }
  }
};

// Helper functions for validation
function validateRequiredProperties(item, itemId) {
  const errors = [];
  
  for (const requiredProp of ITEM_RULES.required) {
    if (!item.hasOwnProperty(requiredProp)) {
      errors.push(`Item "${itemId}" is missing required property "${requiredProp}"`);
    }
  }
  
  return errors;
}

function validateBasicProperties(item, itemId) {
  const errors = [];
  
  // Validate symbol property
  if (item.hasOwnProperty('symbol')) {
    const symbol = item.symbol;
    const symbolRules = ITEM_RULES.properties.symbol;
    
    if (typeof symbol !== 'string') {
      errors.push(`Item "${itemId}" has invalid symbol type. Expected string, got ${typeof symbol}`);
    } else if (symbol.length < symbolRules.minLength) {
      errors.push(`Item "${itemId}" has symbol that is too short. Expected at least ${symbolRules.minLength} character, got ${symbol.length}`);
    } else if (symbol.length > symbolRules.maxLength) {
      errors.push(`Item "${itemId}" has symbol that is too long. Expected at most ${symbolRules.maxLength} character, got ${symbol.length}`);
    }
  }
  
  return errors;
}

function validatePropertyRules(item, itemId) {
  const errors = [];
  
  for (const [propertyName, propertyRules] of Object.entries(ITEM_RULES.properties)) {
    // Skip basic properties that are handled separately
    if (propertyName === 'symbol') {
      continue;
    }
    
    if (item.hasOwnProperty(propertyName)) {
      // Check required sub-properties
      for (const requiredSubProp of propertyRules.required) {
        if (!item[propertyName].hasOwnProperty(requiredSubProp)) {
          errors.push(`Item "${itemId}" with "${propertyName}" property is missing required sub-property "${requiredSubProp}"`);
        }
      }
      
      // Validate sub-property values
      for (const [subPropName, subPropRules] of Object.entries(propertyRules)) {
        if (subPropName !== 'required' && item[propertyName].hasOwnProperty(subPropName)) {
          const value = item[propertyName][subPropName];
          
          if (subPropRules.validValues && !subPropRules.validValues.includes(value)) {
            errors.push(`Item "${itemId}" has invalid "${subPropName}" value "${value}" for "${propertyName}" property. Valid values: [${subPropRules.validValues.join(', ')}]`);
          }
          
          if (subPropRules.pattern && !subPropRules.pattern.test(value)) {
            errors.push(`Item "${itemId}" has invalid "${subPropName}" value "${value}" for "${propertyName}" property. Expected format: ${subPropRules.description}`);
          }
        }
      }
    }
  }
  
  return errors;
}

describe('Item Data Validation', () => {
  describe('Basic Structure', () => {
    test('should load items.json successfully', () => {
      expect(itemsData).toBeDefined();
      expect(typeof itemsData).toBe('object');
      expect(Object.keys(itemsData).length).toBeGreaterThan(0);
    });

    test('should have valid JSON structure', () => {
      const itemIds = Object.keys(itemsData);
      expect(itemIds.length).toBeGreaterThan(0);
      
      itemIds.forEach(itemId => {
        expect(typeof itemId).toBe('string');
        expect(itemId.length).toBeGreaterThan(0);
        expect(typeof itemsData[itemId]).toBe('object');
      });
    });
  });

  describe('Required Properties', () => {
    test('all items should have required properties', () => {
      const errors = [];
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        errors.push(...validateRequiredProperties(item, itemId));
      });
      
      if (errors.length > 0) {
        throw new Error(`Validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('all items should have a name property', () => {
      Object.entries(itemsData).forEach(([itemId, item]) => {
        expect(item).toHaveProperty('name');
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
      });
    });

    test('all items should have a symbol property', () => {
      Object.entries(itemsData).forEach(([itemId, item]) => {
        expect(item).toHaveProperty('symbol');
        expect(typeof item.symbol).toBe('string');
        expect(item.symbol.length).toBe(1);
      });
    });
  });

  describe('Equipment Property Validation', () => {
    test('equipment items should have required sub-properties', () => {
      const errors = [];
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment')) {
          errors.push(...validatePropertyRules(item, itemId));
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Equipment validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('equipment items should have valid slot values', () => {
      const validSlots = ITEM_RULES.properties.equipment.slot.validValues;
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment')) {
          expect(item.equipment).toHaveProperty('slot');
          expect(validSlots).toContain(item.equipment.slot);
        }
      });
    });

    test('equipment items should have valid effect values', () => {
      const effectPattern = ITEM_RULES.properties.equipment.effect.pattern;
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment')) {
          expect(item.equipment).toHaveProperty('effect');
          expect(effectPattern.test(item.equipment.effect)).toBe(true);
        }
      });
    });

    test('equipment effect values should have positive integers', () => {
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment')) {
          const effect = item.equipment.effect;
          const match = effect.match(/^(armor|hpBonus|attack|defense)\+(\d+)$/);
          expect(match).toBeTruthy();
          
          const effectValue = parseInt(match[2], 10);
          expect(effectValue).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Usable Property Validation', () => {
    test('usable items should have required sub-properties', () => {
      const errors = [];
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('usable')) {
          errors.push(...validatePropertyRules(item, itemId));
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Usable validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('usable items should have valid use_effect values', () => {
      const useEffectPattern = ITEM_RULES.properties.usable.use_effect.pattern;
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('usable')) {
          expect(item.usable).toHaveProperty('use_effect');
          expect(useEffectPattern.test(item.usable.use_effect)).toBe(true);
        }
      });
    });

    test('usable use_effect values should have positive integers', () => {
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('usable')) {
          const useEffect = item.usable.use_effect;
          const match = useEffect.match(/^currentHp\+(\d+)$/);
          expect(match).toBeTruthy();
          
          const hpValue = parseInt(match[1], 10);
          expect(hpValue).toBeGreaterThan(0);
        }
      });
    });
  });



  describe('Effect Manager Integration', () => {
    test('all equipment items should have valid effects according to EffectManager', () => {
      const errors = [];
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment') && item.equipment.hasOwnProperty('effect')) {
          const isValid = EffectManager.validateEffect(item.equipment.effect);
          if (!isValid) {
            errors.push(`Item "${itemId}" has invalid effect "${item.equipment.effect}"`);
          }
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Effect validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('all equipment effects should be parseable by EffectManager', () => {
      Object.entries(itemsData).forEach(([itemId, item]) => {
        if (item.hasOwnProperty('equipment') && item.equipment.hasOwnProperty('effect')) {
          const parsed = EffectManager.parseEffect(item.equipment.effect);
          expect(parsed).not.toBeNull();
          expect(parsed.value).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Comprehensive Validation', () => {
    test('all items should pass comprehensive validation', () => {
      const errors = [];
      
      Object.entries(itemsData).forEach(([itemId, item]) => {
        // Check required properties
        errors.push(...validateRequiredProperties(item, itemId));
        
        // Check basic properties
        errors.push(...validateBasicProperties(item, itemId));
        
        // Check property-specific rules
        errors.push(...validatePropertyRules(item, itemId));
      });
      
      if (errors.length > 0) {
        throw new Error(`Comprehensive validation errors found:\n${errors.join('\n')}`);
      }
    });


  });
});
