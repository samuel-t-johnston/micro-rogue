import { 
  BaseMode, 
  DefaultMode, 
  DirectionalMode, 
  NumericMode, 
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
        useFurniture: jest.fn()
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

    test('should provide display text', () => {
      const displayText = defaultMode.getDisplayText();
      expect(displayText).toBe('Game Controls');
    });

    test('should provide control instructions', () => {
      const instructions = defaultMode.getControlInstructions();
      expect(instructions).toEqual([
        { label: 'Movement:', keys: 'WASD or Arrow Keys' },
        { label: 'P:', keys: 'Pick up' },
        { label: 'U:', keys: 'Use something nearby' }
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
