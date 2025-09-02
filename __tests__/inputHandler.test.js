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
    
    mockChoiceModeManager = {
      handleInput: jest.fn(),
      getCurrentMode: jest.fn().mockReturnValue('default')
    };

    const mockUpdateGameUICallback = jest.fn();
    inputHandler = new InputHandler(mockGameState, mockGameDisplay, mockChoiceModeManager, mockUpdateGameUICallback);
  });

  describe('Constructor', () => {
    test('should create InputHandler with correct properties', () => {
      expect(inputHandler.gameState).toBe(mockGameState);
      expect(inputHandler.gameDisplay).toBe(mockGameDisplay);
      expect(inputHandler.choiceModeManager).toBe(mockChoiceModeManager);
      expect(inputHandler.isInitialized).toBe(false);
      expect(inputHandler.gameActions).toBeDefined();
      expect(typeof inputHandler.gameActions.movePlayer).toBe('function');
      expect(typeof inputHandler.gameActions.pickUpItem).toBe('function');
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

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1); // Only keydown event listener

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
        inputHandler.gameActions
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
        inputHandler.gameActions
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
