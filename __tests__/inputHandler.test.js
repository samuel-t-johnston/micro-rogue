import { InputHandler } from '../src/js/systems/inputHandler.js';

describe('InputHandler', () => {
  let inputHandler;
  let mockGameState;
  let mockGameDisplay;
  let mockGameActions;
  let mockChoiceModeManager;

  beforeEach(() => {
    mockGameState = {
      turns: 5
    };
    
    mockGameDisplay = {};
    
    mockGameActions = {
      movePlayer: jest.fn(),
      pickUpItem: jest.fn(),
      useFurniture: jest.fn(),
      startNewGame: jest.fn()
    };

    mockChoiceModeManager = {
      handleInput: jest.fn(),
      getCurrentMode: jest.fn().mockReturnValue('default')
    };

    inputHandler = new InputHandler(mockGameState, mockGameDisplay, mockGameActions, mockChoiceModeManager);
  });

  describe('Constructor', () => {
    test('should create InputHandler with correct properties', () => {
      expect(inputHandler.gameState).toBe(mockGameState);
      expect(inputHandler.gameDisplay).toBe(mockGameDisplay);
      expect(inputHandler.gameActions).toBe(mockGameActions);
      expect(inputHandler.choiceModeManager).toBe(mockChoiceModeManager);
      expect(inputHandler.isInitialized).toBe(false);
    });
  });

  describe('init', () => {
    test('should initialize event listeners on first call', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const getElementByIdSpy = jest.spyOn(document, 'getElementById').mockReturnValue({
        addEventListener: jest.fn()
      });

      inputHandler.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', inputHandler.handleKeyDown);
      expect(inputHandler.isInitialized).toBe(true);

      addEventListenerSpy.mockRestore();
      getElementByIdSpy.mockRestore();
    });

    test('should not initialize twice', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const getElementByIdSpy = jest.spyOn(document, 'getElementById').mockReturnValue({
        addEventListener: jest.fn()
      });

      inputHandler.init();
      inputHandler.init();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

      addEventListenerSpy.mockRestore();
      getElementByIdSpy.mockRestore();
    });
  });

  describe('handleKeyDown', () => {
    test('should delegate to choice mode manager', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        key: 'w'
      };

      mockChoiceModeManager.handleInput.mockReturnValue(true);

      inputHandler.handleKeyDown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockChoiceModeManager.handleInput).toHaveBeenCalledWith(
        'w',
        mockGameState,
        mockGameDisplay,
        mockGameActions
      );
    });

    test('should handle invalid input gracefully', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        key: 'x'
      };

      mockChoiceModeManager.handleInput.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      inputHandler.handleKeyDown(mockEvent);

      // Should NOT prevent default for invalid input (allows browser shortcuts)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockChoiceModeManager.handleInput).toHaveBeenCalledWith(
        'x',
        mockGameState,
        mockGameDisplay,
        mockGameActions
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateGameState', () => {
    test('should update game state reference', () => {
      const newGameState = { turns: 10 };
      inputHandler.updateGameState(newGameState);
      expect(inputHandler.gameState).toBe(newGameState);
    });
  });

  describe('destroy', () => {
    test('should mark as not initialized', () => {
      inputHandler.isInitialized = true;
      inputHandler.destroy();
      expect(inputHandler.isInitialized).toBe(false);
    });
  });
});
