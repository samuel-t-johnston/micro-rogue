import { 
  BaseMode, 
  DefaultMode, 
  DirectionalMode, 
  NumericMode, 
  YNMode,
  ModeRegistry,
  defaultModeRegistry 
} from '../src/js/systems/choiceModes/index.js';

describe('Choice Modes', () => {
  describe('BaseMode', () => {
    test('should be abstract and throw error when handleInput is called', () => {
      const baseMode = new BaseMode();
      expect(() => {
        baseMode.handleInput('w', null, null, null, null, null);
      }).toThrow('handleInput must be implemented by subclass');
    });

    test('should have isValidKey method', () => {
      const baseMode = new BaseMode();
      baseMode.validKeys = ['w', 'a', 's', 'd'];
      
      expect(baseMode.isValidKey('w')).toBe(true);
      expect(baseMode.isValidKey('W')).toBe(true); // case insensitive
      expect(baseMode.isValidKey('x')).toBe(false);
    });

    test('should return null for getDisplayText by default', () => {
      const baseMode = new BaseMode();
      expect(baseMode.getDisplayText(null)).toBeNull();
    });

    test('should return empty array for getControlInstructions by default', () => {
      const baseMode = new BaseMode();
      expect(baseMode.getControlInstructions(null)).toEqual([]);
    });
  });

  describe('DefaultMode', () => {
    let defaultMode;
    let mockGameActions;
    let mockModeManager;

    beforeEach(() => {
      defaultMode = new DefaultMode();
    mockGameActions = {
      movePlayer: jest.fn(),
      pickUpItem: jest.fn(),
      getAvailableItems: jest.fn(),
      useFurniture: jest.fn(),
      getAvailableEquipment: jest.fn(),
      showMessage: jest.fn()
    };
      mockModeManager = {
        setMode: jest.fn(),
        resetToDefault: jest.fn()
      };
    });

    test('should have correct valid keys', () => {
      expect(defaultMode.validKeys).toContain('w');
      expect(defaultMode.validKeys).toContain('p');
      expect(defaultMode.validKeys).toContain('u');
      expect(defaultMode.validKeys).toContain('escape');
    });

    test('should handle movement keys', () => {
      defaultMode.handleInput('w', null, null, null, mockGameActions, mockModeManager);
      expect(mockGameActions.movePlayer).toHaveBeenCalledWith(0, -1);

      defaultMode.handleInput('s', null, null, null, mockGameActions, mockModeManager);
      expect(mockGameActions.movePlayer).toHaveBeenCalledWith(0, 1);

      defaultMode.handleInput('a', null, null, null, mockGameActions, mockModeManager);
      expect(mockGameActions.movePlayer).toHaveBeenCalledWith(-1, 0);

      defaultMode.handleInput('d', null, null, null, mockGameActions, mockModeManager);
      expect(mockGameActions.movePlayer).toHaveBeenCalledWith(1, 0);
    });

    test('should handle pickup with multiple items', () => {
      mockGameActions.getAvailableItems.mockReturnValue(['item1', 'item2']);
      
      defaultMode.handleInput('p', null, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.getAvailableItems).toHaveBeenCalled();
      expect(mockModeManager.setMode).toHaveBeenCalledWith('numeric', {
        action: 'pickup',
        items: ['item1', 'item2']
      });
    });

    test('should handle pickup with single item', () => {
      mockGameActions.getAvailableItems.mockReturnValue(['item1']);
      
      defaultMode.handleInput('p', null, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.pickUpItem).toHaveBeenCalled();
    });

    test('should handle use action', () => {
      defaultMode.handleInput('u', null, null, null, mockGameActions, mockModeManager);
      
      expect(mockModeManager.setMode).toHaveBeenCalledWith('directional', { action: 'use' });
    });

    test('should handle equip action with available equipment', () => {
      const equipment = [{ name: 'Helmet', itemId: 'helmet' }];
      mockGameActions.getAvailableEquipment.mockReturnValue(equipment);
      
      defaultMode.handleInput('e', null, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.getAvailableEquipment).toHaveBeenCalled();
      expect(mockModeManager.setMode).toHaveBeenCalledWith('numeric', {
        action: 'equip',
        items: equipment
      });
    });

    test('should show message when no equipment available', () => {
      mockGameActions.getAvailableEquipment.mockReturnValue([]);
      
      defaultMode.handleInput('e', null, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.getAvailableEquipment).toHaveBeenCalled();
      expect(mockGameActions.showMessage).toHaveBeenCalledWith('You have no equipment to equip.');
    });

    test('should provide display text', () => {
      const displayText = defaultMode.getDisplayText();
      expect(displayText).toBe('What would you like to do?');
    });

    test('should provide control instructions', () => {
      const instructions = defaultMode.getControlInstructions();
      expect(instructions).toEqual([
        { label: 'Movement:', keys: 'WASD or Arrow Keys' },
        { label: 'P:', keys: 'Pick up' },
        { label: 'U:', keys: 'Use something nearby' },
        { label: 'E:', keys: 'Equip item' }
      ]);
    });
  });

  describe('DirectionalMode', () => {
    let directionalMode;
    let mockGameActions;
    let mockModeManager;

    beforeEach(() => {
      directionalMode = new DirectionalMode();
      mockGameActions = {
        useFurniture: jest.fn()
      };
      mockModeManager = {
        resetToDefault: jest.fn()
      };
    });

    test('should have correct valid keys including diagonals', () => {
      expect(directionalMode.validKeys).toContain('w');
      expect(directionalMode.validKeys).toContain('q');
      expect(directionalMode.validKeys).toContain('e');
      expect(directionalMode.validKeys).toContain('z');
      expect(directionalMode.validKeys).toContain('c');
    });

    test('should handle escape key', () => {
      directionalMode.handleInput('escape', null, null, null, mockGameActions, mockModeManager);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should handle use action with direction', () => {
      mockGameActions.useFurniture.mockReturnValue(true);
      
      directionalMode.handleInput('w', { action: 'use' }, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.useFurniture).toHaveBeenCalledWith(0, -1);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should provide display text for use action', () => {
      const displayText = directionalMode.getDisplayText({ action: 'use' });
      expect(displayText).toBe('Use - What would you like to use?');
    });
  });

  describe('NumericMode', () => {
    let numericMode;
    let mockGameActions;
    let mockModeManager;

    beforeEach(() => {
      numericMode = new NumericMode();
      mockGameActions = {
        pickUpItemByIndex: jest.fn()
      };
      mockModeManager = {
        resetToDefault: jest.fn()
      };
    });

    test('should have numeric keys and escape', () => {
      expect(numericMode.validKeys).toContain('0');
      expect(numericMode.validKeys).toContain('9');
      expect(numericMode.validKeys).toContain('escape');
      expect(numericMode.validKeys).not.toContain('a');
    });

    test('should handle escape key', () => {
      numericMode.handleInput('escape', null, null, null, mockGameActions, mockModeManager);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should handle numeric selection', () => {
      mockGameActions.pickUpItemByIndex.mockReturnValue(true);
      
      numericMode.handleInput('3', { action: 'pickup' }, null, null, mockGameActions, mockModeManager);
      
      expect(mockGameActions.pickUpItemByIndex).toHaveBeenCalledWith(3);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should provide display text for pickup action', () => {
      const displayText = numericMode.getDisplayText({ action: 'pickup' });
      expect(displayText).toBe('Pick up - What would you like to pick up?');
    });

    test('should handle equip action', () => {
      const mockGameActions = {
        equipItemByIndex: jest.fn().mockReturnValue(true)
      };
      const mockModeManager = { resetToDefault: jest.fn() };
      const context = { action: 'equip' };

      const result = numericMode.handleInput('1', context, null, null, mockGameActions, mockModeManager);

      expect(result).toBe(true);
      expect(mockGameActions.equipItemByIndex).toHaveBeenCalledWith(1, mockModeManager);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should provide display text for equip action', () => {
      const context = { action: 'equip' };
      const displayText = numericMode.getDisplayText(context);
      expect(displayText).toBe('Equip - What would you like to equip?');
    });

    test('should provide control instructions for equip action', () => {
      const context = { action: 'equip' };
      const instructions = numericMode.getControlInstructions(context);
      expect(instructions).toEqual([
        { label: 'Choose equip:', keys: '0-9' },
        { label: 'ESC:', keys: 'Cancel' }
      ]);
    });
  });

  describe('YNMode', () => {
    let ynMode;
    let mockGameActions;
    let mockModeManager;

    beforeEach(() => {
      ynMode = new YNMode();
      mockGameActions = {
        equipItemWithReplacement: jest.fn().mockReturnValue(true)
      };
      mockModeManager = {
        resetToDefault: jest.fn()
      };
    });

    test('should have correct valid keys', () => {
      expect(ynMode.validKeys).toEqual(['y', 'n', 'escape']);
    });

    test('should handle escape key', () => {
      const result = ynMode.handleInput('escape', null, null, null, mockGameActions, mockModeManager);
      
      expect(result).toBe(true);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should handle Y key for equip action', () => {
      const context = {
        action: 'equip',
        itemIndex: 0,
        existingItem: { name: 'Old Helm' },
        slot: 'head'
      };

      const result = ynMode.handleInput('y', context, null, null, mockGameActions, mockModeManager);
      
      expect(result).toBe(true);
      expect(mockGameActions.equipItemWithReplacement).toHaveBeenCalledWith(0, context.existingItem, context.slot);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
    });

    test('should handle N key', () => {
      const context = { action: 'equip' };

      const result = ynMode.handleInput('n', context, null, null, mockGameActions, mockModeManager);
      
      expect(result).toBe(true);
      expect(mockModeManager.resetToDefault).toHaveBeenCalled();
      expect(mockGameActions.equipItemWithReplacement).not.toHaveBeenCalled();
    });

    test('should return false for invalid keys', () => {
      const result = ynMode.handleInput('x', null, null, null, mockGameActions, mockModeManager);
      expect(result).toBe(false);
    });

    test('should provide display text for equip action', () => {
      const context = {
        action: 'equip',
        existingItem: { name: 'Iron Helm' },
        newItem: { name: 'Leather Helm' },
        slot: 'head'
      };

      const displayText = ynMode.getDisplayText(context);
      expect(displayText).toBe('You have a Iron Helm equipped in your head slot. Remove it to equip Leather Helm?');
    });

    test('should provide default display text', () => {
      const displayText = ynMode.getDisplayText(null);
      expect(displayText).toBe('Yes or No?');
    });

    test('should provide control instructions', () => {
      const instructions = ynMode.getControlInstructions();
      expect(instructions).toEqual([
        { label: 'Y:', keys: 'Yes' },
        { label: 'N:', keys: 'No' },
        { label: 'ESC:', keys: 'Cancel' }
      ]);
    });
  });

  describe('ModeRegistry', () => {
    let registry;

    beforeEach(() => {
      registry = new ModeRegistry();
    });

    test('should register and retrieve modes', () => {
      registry.register('test', DefaultMode);
      
      expect(registry.hasMode('test')).toBe(true);
      expect(registry.hasMode('nonexistent')).toBe(false);
      
      const mode = registry.getMode('test');
      expect(mode).toBeInstanceOf(DefaultMode);
    });

    test('should throw error for unknown mode', () => {
      expect(() => {
        registry.getMode('nonexistent');
      }).toThrow('Unknown mode: nonexistent');
    });

    test('should return registered mode names', () => {
      registry.register('mode1', DefaultMode);
      registry.register('mode2', DirectionalMode);
      
      const modes = registry.getRegisteredModes();
      expect(modes).toContain('mode1');
      expect(modes).toContain('mode2');
    });
  });

  describe('defaultModeRegistry', () => {
    test('should have all default modes registered', () => {
      expect(defaultModeRegistry.hasMode('default')).toBe(true);
      expect(defaultModeRegistry.hasMode('directional')).toBe(true);
      expect(defaultModeRegistry.hasMode('numeric')).toBe(true);
    });

    test('should return correct mode instances', () => {
      const defaultMode = defaultModeRegistry.getMode('default');
      const directionalMode = defaultModeRegistry.getMode('directional');
      const numericMode = defaultModeRegistry.getMode('numeric');
      
      expect(defaultMode).toBeInstanceOf(DefaultMode);
      expect(directionalMode).toBeInstanceOf(DirectionalMode);
      expect(numericMode).toBeInstanceOf(NumericMode);
    });
  });
});
