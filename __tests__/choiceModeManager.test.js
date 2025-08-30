import { ChoiceModeManager } from '../choiceModeManager.js';

describe('ChoiceModeManager', () => {
  let choiceModeManager;
  let mockGameState;
  let mockGameDisplay;
  let mockGameActions;

  beforeEach(() => {
    choiceModeManager = new ChoiceModeManager();
    
    mockGameState = {
      turns: 5
    };
    
    mockGameDisplay = {};
    
    mockGameActions = {
      movePlayer: jest.fn(),
      pickUpItem: jest.fn(),
      getAvailableItems: jest.fn(),
      useFurniture: jest.fn()
    };
  });

  describe('constructor', () => {
    test('should initialize with default mode', () => {
      expect(choiceModeManager.getCurrentMode()).toBe('default');
      expect(choiceModeManager.getActionContext()).toBeNull();
    });
  });

  describe('setMode', () => {
    test('should set mode and context', () => {
      const context = { action: 'use' };
      choiceModeManager.setMode('directional', context);
      
      expect(choiceModeManager.getCurrentMode()).toBe('directional');
      expect(choiceModeManager.getActionContext()).toBe(context);
    });

    test('should set mode without context', () => {
      choiceModeManager.setMode('directional');
      
      expect(choiceModeManager.getCurrentMode()).toBe('directional');
      expect(choiceModeManager.getActionContext()).toBeNull();
    });
  });

  describe('resetToDefault', () => {
    test('should reset to default mode', () => {
      choiceModeManager.setMode('directional', { action: 'use' });
      choiceModeManager.resetToDefault();
      
      expect(choiceModeManager.getCurrentMode()).toBe('default');
      expect(choiceModeManager.getActionContext()).toBeNull();
    });
  });

  describe('isInSpecialMode', () => {
    test('should return false for default mode', () => {
      expect(choiceModeManager.isInSpecialMode()).toBe(false);
    });

    test('should return true for special mode', () => {
      choiceModeManager.setMode('directional');
      expect(choiceModeManager.isInSpecialMode()).toBe(true);
    });
  });

  describe('getModeDisplayText', () => {
    test('should return null for default mode', () => {
      expect(choiceModeManager.getModeDisplayText()).toBeNull();
    });

    test('should return display text for directional mode with use context', () => {
      choiceModeManager.setMode('directional', { action: 'use' });
      expect(choiceModeManager.getModeDisplayText()).toBe('Use - choose direction (WASD/QEZC/arrows) or ESC to cancel');
    });

    test('should return display text for directional mode without context', () => {
      choiceModeManager.setMode('directional');
      expect(choiceModeManager.getModeDisplayText()).toBe('Choose direction (WASD/QEZC/arrows) or ESC to cancel');
    });
  });

  describe('handleInput - default mode', () => {
    test('should handle movement keys', () => {
      const keys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      
      keys.forEach(key => {
        choiceModeManager.handleInput(key, mockGameState, mockGameDisplay, mockGameActions);
        expect(mockGameActions.movePlayer).toHaveBeenCalled();
      });
    });

    test('should handle pickup key', () => {
      // Mock single item scenario
      mockGameActions.getAvailableItems.mockReturnValue([{ name: 'Sword', source: 'ground' }]);
      
      choiceModeManager.handleInput('p', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(mockGameActions.getAvailableItems).toHaveBeenCalled();
      expect(mockGameActions.pickUpItem).toHaveBeenCalled();
    });

    test('should enter directional mode for use key', () => {
      choiceModeManager.handleInput('u', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(choiceModeManager.getCurrentMode()).toBe('directional');
      expect(choiceModeManager.getActionContext()).toEqual({ action: 'use' });
    });

    test('should return false for invalid keys', () => {
      const result = choiceModeManager.handleInput('x', mockGameState, mockGameDisplay, mockGameActions);
      expect(result).toBe(false);
    });
  });

  describe('handleInput - directional mode', () => {
    beforeEach(() => {
      choiceModeManager.setMode('directional', { action: 'use' });
      mockGameActions.useFurniture.mockClear();
    });

    test('should handle cardinal directions', () => {
      const directionMap = {
        'w': { dx: 0, dy: -1 },
        'a': { dx: -1, dy: 0 },
        's': { dx: 0, dy: 1 },
        'd': { dx: 1, dy: 0 }
      };

      Object.entries(directionMap).forEach(([key, expectedDirection]) => {
        // Reset the mock for each iteration
        mockGameActions.useFurniture.mockClear();
        mockGameActions.useFurniture.mockReturnValue(true);
        
        // Ensure we're in directional mode with use context
        choiceModeManager.setMode('directional', { action: 'use' });
        
        choiceModeManager.handleInput(key, mockGameState, mockGameDisplay, mockGameActions);
        
        expect(mockGameActions.useFurniture).toHaveBeenCalledWith(
          expectedDirection.dx, 
          expectedDirection.dy
        );
      });
    });

    test('should handle diagonal directions', () => {
      const directionMap = {
        'q': { dx: -1, dy: -1 },
        'e': { dx: 1, dy: -1 },
        'z': { dx: -1, dy: 1 },
        'c': { dx: 1, dy: 1 }
      };

      Object.entries(directionMap).forEach(([key, expectedDirection]) => {
        // Reset the mock for each iteration
        mockGameActions.useFurniture.mockClear();
        mockGameActions.useFurniture.mockReturnValue(true);
        
        // Ensure we're in directional mode with use context
        choiceModeManager.setMode('directional', { action: 'use' });
        
        choiceModeManager.handleInput(key, mockGameState, mockGameDisplay, mockGameActions);
        
        expect(mockGameActions.useFurniture).toHaveBeenCalledWith(
          expectedDirection.dx, 
          expectedDirection.dy
        );
      });
    });

    test('should handle arrow keys', () => {
      const directionMap = {
        'arrowup': { dx: 0, dy: -1 },
        'arrowleft': { dx: -1, dy: 0 },
        'arrowdown': { dx: 0, dy: 1 },
        'arrowright': { dx: 1, dy: 0 }
      };

      Object.entries(directionMap).forEach(([key, expectedDirection]) => {
        // Reset the mock for each iteration
        mockGameActions.useFurniture.mockClear();
        mockGameActions.useFurniture.mockReturnValue(true);
        
        // Ensure we're in directional mode with use context
        choiceModeManager.setMode('directional', { action: 'use' });
        
        choiceModeManager.handleInput(key, mockGameState, mockGameDisplay, mockGameActions);
        
        expect(mockGameActions.useFurniture).toHaveBeenCalledWith(
          expectedDirection.dx, 
          expectedDirection.dy
        );
      });
    });

    test('should exit mode on escape', () => {
      choiceModeManager.handleInput('escape', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(choiceModeManager.getCurrentMode()).toBe('default');
      expect(choiceModeManager.getActionContext()).toBeNull();
    });

    test('should stay in mode when use action fails', () => {
      mockGameActions.useFurniture.mockReturnValue(false);
      
      choiceModeManager.handleInput('w', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(choiceModeManager.getCurrentMode()).toBe('directional');
      expect(choiceModeManager.getActionContext()).toEqual({ action: 'use' });
    });

    test('should exit mode when use action succeeds', () => {
      mockGameActions.useFurniture.mockReturnValue(true);
      
      choiceModeManager.handleInput('w', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(choiceModeManager.getCurrentMode()).toBe('default');
      expect(choiceModeManager.getActionContext()).toBeNull();
    });

    test('should return false for invalid keys', () => {
      const result = choiceModeManager.handleInput('x', mockGameState, mockGameDisplay, mockGameActions);
      expect(result).toBe(false);
    });

    test('should verify context is passed correctly', () => {
      mockGameActions.useFurniture.mockReturnValue(true);
      
      // Check context before action
      expect(choiceModeManager.getActionContext()).toEqual({ action: 'use' });
      
      choiceModeManager.handleInput('w', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(mockGameActions.useFurniture).toHaveBeenCalledWith(0, -1);
      // After successful action, should be back to default mode
      expect(choiceModeManager.getCurrentMode()).toBe('default');
    });

    test('should debug key handling', () => {
      mockGameActions.useFurniture.mockReturnValue(true);
      
      // Test a single key to see what happens
      const result = choiceModeManager.handleInput('w', mockGameState, mockGameDisplay, mockGameActions);
      
      expect(result).toBe(true);
      expect(mockGameActions.useFurniture).toHaveBeenCalledWith(0, -1);
    });
  });

  describe('case insensitivity', () => {
    test('should handle uppercase keys in default mode', () => {
      choiceModeManager.handleInput('W', mockGameState, mockGameDisplay, mockGameActions);
      expect(mockGameActions.movePlayer).toHaveBeenCalledWith(0, -1);
    });

    test('should handle uppercase keys in directional mode', () => {
      choiceModeManager.setMode('directional', { action: 'use' });
      mockGameActions.useFurniture.mockReturnValue(true);
      
      choiceModeManager.handleInput('W', mockGameState, mockGameDisplay, mockGameActions);
      expect(mockGameActions.useFurniture).toHaveBeenCalledWith(0, -1);
    });
  });
});
