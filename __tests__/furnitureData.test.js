import furnitureData from '../furniture.json';
import itemsData from '../items.json';

// Furniture validation rules and configurations
const FURNITURE_RULES = {
  // Required properties for all furniture
  required: ['name', 'symbol'],
  
  // Property-specific rules
  properties: {
    stateful: {
      required: ['states', 'defaultState'],
      states: {
        type: 'array',
        minLength: 1
      },
      defaultState: {
        type: 'string'
      }
    },
    usable: {
      required: ['action'],
      action: {
        validValues: ['toggle_state']
      }
    },
    container: {
      required: ['capacity'],
      capacity: {
        type: 'number',
        minValue: 1
      }
    }
  }
};

// Helper functions for validation
function validateRequiredProperties(furniture, furnitureId) {
  const errors = [];
  
  for (const requiredProp of FURNITURE_RULES.required) {
    if (!furniture.hasOwnProperty(requiredProp)) {
      errors.push(`Furniture "${furnitureId}" is missing required property "${requiredProp}"`);
    }
  }
  
  return errors;
}

function validatePropertyRules(furniture, furnitureId) {
  const errors = [];
  
  for (const [propertyName, propertyRules] of Object.entries(FURNITURE_RULES.properties)) {
    if (furniture.hasOwnProperty(propertyName)) {
      // Special handling for stateful property - required properties are top-level
      if (propertyName === 'stateful') {
        for (const requiredProp of propertyRules.required) {
          if (!furniture.hasOwnProperty(requiredProp)) {
            errors.push(`Furniture "${furnitureId}" with "${propertyName}" property is missing required property "${requiredProp}"`);
          }
        }
        
        // Validate top-level state properties
        if (furniture.hasOwnProperty('states')) {
          const statesRules = propertyRules.states;
          const value = furniture.states;
          
          if (statesRules.type === 'array' && !Array.isArray(value)) {
            errors.push(`Furniture "${furnitureId}" has invalid "states" value. Expected array, got ${typeof value}`);
          }
          
          if (statesRules.type === 'array' && statesRules.minLength && value.length < statesRules.minLength) {
            errors.push(`Furniture "${furnitureId}" has invalid "states" array length. Expected at least ${statesRules.minLength}, got ${value.length}`);
          }
        }
        
        if (furniture.hasOwnProperty('defaultState')) {
          const defaultStateRules = propertyRules.defaultState;
          const value = furniture.defaultState;
          
          if (defaultStateRules.type === 'string' && typeof value !== 'string') {
            errors.push(`Furniture "${furnitureId}" has invalid "defaultState" value. Expected string, got ${typeof value}`);
          }
        }
      } else {
        // Regular sub-property validation for other properties
        for (const requiredSubProp of propertyRules.required) {
          if (!furniture[propertyName].hasOwnProperty(requiredSubProp)) {
            errors.push(`Furniture "${furnitureId}" with "${propertyName}" property is missing required sub-property "${requiredSubProp}"`);
          }
        }
        
        // Validate sub-property values
        for (const [subPropName, subPropRules] of Object.entries(propertyRules)) {
          if (subPropName !== 'required' && furniture[propertyName].hasOwnProperty(subPropName)) {
            const value = furniture[propertyName][subPropName];
            
            if (subPropRules.validValues && !subPropRules.validValues.includes(value)) {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" value "${value}" for "${propertyName}" property. Valid values: [${subPropRules.validValues.join(', ')}]`);
            }
            
            if (subPropRules.type === 'array' && !Array.isArray(value)) {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" value for "${propertyName}" property. Expected array, got ${typeof value}`);
            }
            
            if (subPropRules.type === 'array' && subPropRules.minLength && value.length < subPropRules.minLength) {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" array length for "${propertyName}" property. Expected at least ${subPropRules.minLength}, got ${value.length}`);
            }
            
            if (subPropRules.type === 'number' && typeof value !== 'number') {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" value for "${propertyName}" property. Expected number, got ${typeof value}`);
            }
            
            if (subPropRules.type === 'number' && subPropRules.minValue && value < subPropRules.minValue) {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" value for "${propertyName}" property. Expected at least ${subPropRules.minValue}, got ${value}`);
            }
            
            if (subPropRules.type === 'string' && typeof value !== 'string') {
              errors.push(`Furniture "${furnitureId}" has invalid "${subPropName}" value for "${propertyName}" property. Expected string, got ${typeof value}`);
            }
          }
        }
      }
    }
  }
  
  return errors;
}

function validateStatefulFurniture(furniture, furnitureId) {
  const errors = [];
  
  if (furniture.stateful) {
    // Check that states array contains the default state
    if (!furniture.states.includes(furniture.defaultState)) {
      errors.push(`Furniture "${furnitureId}" has defaultState "${furniture.defaultState}" that is not in states array: [${furniture.states.join(', ')}]`);
    }
    
    // Check that impassibleWhen states are valid
    if (furniture.impassibleWhen) {
      for (const state of furniture.impassibleWhen) {
        if (!furniture.states.includes(state)) {
          errors.push(`Furniture "${furnitureId}" has impassibleWhen state "${state}" that is not in states array: [${furniture.states.join(', ')}]`);
        }
      }
    }
  }
  
  return errors;
}

describe('Furniture Data Validation', () => {
  describe('Basic Structure', () => {
    test('should load furniture.json successfully', () => {
      expect(furnitureData).toBeDefined();
      expect(typeof furnitureData).toBe('object');
      expect(Object.keys(furnitureData).length).toBeGreaterThan(0);
    });

    test('should have valid JSON structure', () => {
      const furnitureIds = Object.keys(furnitureData);
      expect(furnitureIds.length).toBeGreaterThan(0);
      
      furnitureIds.forEach(furnitureId => {
        expect(typeof furnitureId).toBe('string');
        expect(furnitureId.length).toBeGreaterThan(0);
        expect(typeof furnitureData[furnitureId]).toBe('object');
      });
    });
  });

  describe('Required Properties', () => {
    test('all furniture should have required properties', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        errors.push(...validateRequiredProperties(furniture, furnitureId));
      });
      
      if (errors.length > 0) {
        throw new Error(`Validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('all furniture should have a name property', () => {
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        expect(furniture).toHaveProperty('name');
        expect(typeof furniture.name).toBe('string');
        expect(furniture.name.length).toBeGreaterThan(0);
      });
    });

    test('all furniture should have a symbol property', () => {
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        expect(furniture).toHaveProperty('symbol');
        expect(typeof furniture.symbol).toBe('string');
        expect(furniture.symbol.length).toBe(1);
      });
    });
  });

  describe('Stateful Furniture Validation', () => {
    test('stateful furniture should have valid state configuration', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        errors.push(...validateStatefulFurniture(furniture, furnitureId));
      });
      
      if (errors.length > 0) {
        throw new Error(`Stateful furniture validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('stateful furniture should have required sub-properties', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.stateful) {
          errors.push(...validatePropertyRules(furniture, furnitureId));
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Stateful furniture validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('stateful furniture should have valid states array', () => {
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.stateful) {
          expect(furniture).toHaveProperty('states');
          expect(Array.isArray(furniture.states)).toBe(true);
          expect(furniture.states.length).toBeGreaterThan(0);
          
          furniture.states.forEach(state => {
            expect(typeof state).toBe('string');
            expect(state.length).toBeGreaterThan(0);
          });
        }
      });
    });

    test('stateful furniture should have valid defaultState', () => {
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.stateful) {
          expect(furniture).toHaveProperty('defaultState');
          expect(typeof furniture.defaultState).toBe('string');
          expect(furniture.states).toContain(furniture.defaultState);
        }
      });
    });
  });

  describe('Usable Furniture Validation', () => {
    test('usable furniture should have required sub-properties', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.hasOwnProperty('usable')) {
          errors.push(...validatePropertyRules(furniture, furnitureId));
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Usable furniture validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('usable furniture should have valid action values', () => {
      const validActions = FURNITURE_RULES.properties.usable.action.validValues;
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.hasOwnProperty('usable')) {
          expect(furniture.usable).toHaveProperty('action');
          expect(validActions).toContain(furniture.usable.action);
        }
      });
    });
  });

  describe('Container Furniture Validation', () => {
    test('container furniture should have required sub-properties', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.hasOwnProperty('container')) {
          errors.push(...validatePropertyRules(furniture, furnitureId));
        }
      });
      
      if (errors.length > 0) {
        throw new Error(`Container furniture validation errors found:\n${errors.join('\n')}`);
      }
    });

    test('container furniture should have valid capacity values', () => {
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        if (furniture.hasOwnProperty('container')) {
          expect(furniture.container).toHaveProperty('capacity');
          expect(typeof furniture.container.capacity).toBe('number');
          expect(furniture.container.capacity).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Symbol Conflict Prevention', () => {
    test('furniture symbols should not conflict with existing game symbols', () => {
      const furnitureSymbols = Object.values(furnitureData).map(f => f.symbol);
      const existingSymbols = ['#', '.', '$', '@']; // Wall, Floor, Item, Player
      
      const conflicts = furnitureSymbols.filter(symbol => existingSymbols.includes(symbol));
      
      if (conflicts.length > 0) {
        throw new Error(`Symbol conflicts found between furniture and existing game symbols: [${conflicts.join(', ')}]`);
      }
    });

    test('furniture symbols should be unique', () => {
      const symbols = Object.values(furnitureData).map(f => f.symbol);
      const uniqueSymbols = new Set(symbols);
      
      if (symbols.length !== uniqueSymbols.size) {
        const duplicates = symbols.filter((symbol, index) => symbols.indexOf(symbol) !== index);
        throw new Error(`Duplicate furniture symbols found: [${duplicates.join(', ')}]`);
      }
    });

    test('furniture symbols should not conflict with item symbols', () => {
      const furnitureSymbols = Object.values(furnitureData).map(f => f.symbol);
      const itemSymbols = Object.values(itemsData).map(item => item.symbol).filter(symbol => symbol);
      
      const conflicts = furnitureSymbols.filter(symbol => itemSymbols.includes(symbol));
      
      if (conflicts.length > 0) {
        throw new Error(`Symbol conflicts found between furniture and items: [${conflicts.join(', ')}]`);
      }
    });
  });

  describe('Comprehensive Validation', () => {
    test('all furniture should pass comprehensive validation', () => {
      const errors = [];
      
      Object.entries(furnitureData).forEach(([furnitureId, furniture]) => {
        // Check required properties
        errors.push(...validateRequiredProperties(furniture, furnitureId));
        
        // Check property-specific rules
        errors.push(...validatePropertyRules(furniture, furnitureId));
        
        // Check stateful furniture rules
        errors.push(...validateStatefulFurniture(furniture, furnitureId));
      });
      
      if (errors.length > 0) {
        throw new Error(`Comprehensive validation errors found:\n${errors.join('\n')}`);
      }
    });
  });
});
