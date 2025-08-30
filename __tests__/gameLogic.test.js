import { pickUpItem, movePlayer, useFurniture } from '../gameLogic.js';
import { GameState } from '../gameState.js';
import { Furniture } from '../furniture.js';

// Mock dependencies
jest.mock('../renderer.js', () => ({
  render: jest.fn(),
}));

jest.mock('../ui.js', () => ({
  addMessage: jest.fn(),
  updateUI: jest.fn(),
}));

jest.mock('../world.js', () => ({
  initializeWorldAsync: jest.fn(),
  placeRandomItems: jest.fn(),
  placeRandomFurniture: jest.fn(),
}));

// Import mocked modules
const { addMessage, updateUI } = require('../ui.js');
const { render } = require('../renderer.js');

describe('gameLogic', () => {
  let gameState;
  let mockGameDisplay;
  let mockChoiceModeManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a fresh game state for each test
    gameState = new GameState();
    gameState.reset();
    
    // Set up a simple test level
    gameState.currentLevel.map = [
      ['#', '#', '#', '#', '#', '#', '#'],
      ['#', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '#'],
      ['#', '#', '#', '#', '#', '#', '#']
    ];
    
    // Set player position to center
    gameState.setPlayerPosition(3, 3);
    
    // Mock game display
    mockGameDisplay = {
      innerHTML: '',
      style: {},
    };
    
    // Mock choice mode manager
    mockChoiceModeManager = {
      isInSpecialMode: jest.fn(() => false),
    };
    
    // Mock items data
    gameState.itemsData = {
      'sword': { name: 'Iron Sword', type: 'weapon' },
      'potion': { name: 'Health Potion', type: 'consumable' },
    };

    // Mock furniture data
    gameState.furnitureData = {
      'door': {
        name: 'Door',
        symbol: '+',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' }
      },
      'chest': {
        name: 'Chest',
        symbol: '=',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' },
        container: { capacity: 5 }
      },
      'table': {
        name: 'Table',
        symbol: 'T',
        usable: { action: 'unknown_action' }
      },
      'broken_door': {
        name: 'Broken Door',
        symbol: '+',
        usable: { action: 'toggle_state' },
        stateful: true,
        states: [],
        defaultState: 'closed'
      },
      'mystery_box': {
        name: 'Mystery Box',
        symbol: '?',
        usable: { action: 'unknown_action' }
      },
      'unknown_object': {
        name: 'Unknown Object',
        symbol: '?',
        usable: { action: 'toggle_state' }
      }
    };
  });

  describe('pickUpItem', () => {
    test('should pick up item when player is on item location', () => {
      // Add an item at player's current position
      gameState.currentLevel.addItem(3, 3, 'sword');
      
      const result = pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(result).toBeUndefined(); // Function returns undefined
      expect(gameState.currentLevel.getItemAt(3, 3)).toBeUndefined();
      expect(gameState.player.inventory).toHaveLength(1);
      expect(gameState.player.inventory[0].itemId).toBe('sword');
    });

    test('should show message when no item at location', () => {
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("There's nothing to pick up.", gameState, gameState.player);
    });

    test('should show message when inventory is full', () => {
      // Fill inventory
      for (let i = 0; i < 5; i++) {
        gameState.player.addToInventory({ name: `Item ${i}`, type: 'misc' });
      }
      
      // Add an item at player's current position
      gameState.currentLevel.addItem(3, 3, 'sword');
      
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("Can't pick anything else up. Inventory is full.", gameState, gameState.player);
    });

    test('should handle unknown item names', () => {
      // Add an item with unknown ID
      gameState.currentLevel.addItem(3, 3, 'unknown_item');
      
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("Picked up Unknown Item!", gameState, gameState.player);
    });

    test('should pick up item from open container when no item on ground', () => {
      // Create a container with items
      const containerData = {
        name: 'Chest',
        symbol: '=',
        container: { capacity: 5 }
      };
      const container = new Furniture(3, 3, 'chest', containerData);
      container.state = 'open';
      container.addItemToContainer({ name: 'Gold Coin', itemId: 'gold_coin' });
      
      // Add container to level
      gameState.currentLevel.furniture.push(container);
      
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("Took Gold Coin from the Chest.", gameState, gameState.player);
    });

    test('should show message when open container is empty', () => {
      // Create an empty open container
      const containerData = {
        name: 'Chest',
        symbol: '=',
        container: { capacity: 5 }
      };
      const container = new Furniture(3, 3, 'chest', containerData);
      container.state = 'open';
      
      // Add container to level
      gameState.currentLevel.furniture.push(container);
      
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("The Chest is empty.", gameState, gameState.player);
    });

    test('should show message when inventory is full at start', () => {
      // Fill inventory
      for (let i = 0; i < 5; i++) {
        gameState.player.addToInventory({ name: `Item ${i}`, type: 'misc' });
      }
      
      pickUpItem(gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("Can't pick anything else up. Inventory is full.", gameState, gameState.player);
    });
  });

  describe('movePlayer', () => {
    test('should move player successfully to empty position', () => {
      const initialPos = gameState.getPlayerPosition();
      const initialTurns = gameState.turns;
      
      const result = movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      // Check position changed
      expect(gameState.getPlayerPosition().x).toBe(initialPos.x + 1);
      expect(gameState.getPlayerPosition().y).toBe(initialPos.y);
      
      // Check turns incremented
      expect(gameState.turns).toBe(initialTurns + 1);
      
      // Check return value
      expect(result).toEqual({ newPlayerX: 4, newPlayerY: 3 });
      
      // Check message was added
      expect(addMessage).toHaveBeenCalledWith("Moved to (4, 3)", gameState, gameState.player);
    });

    test('should block movement to impassible position', () => {
      const initialPos = gameState.getPlayerPosition();
      const initialTurns = gameState.turns;
      
      // Try to move to wall position (y=0 is a wall '#')
      const result = movePlayer(0, -3, gameState, mockGameDisplay, mockChoiceModeManager);
      
      // Check position didn't change
      expect(gameState.getPlayerPosition().x).toBe(initialPos.x);
      expect(gameState.getPlayerPosition().y).toBe(initialPos.y);
      
      // Check turns didn't increment
      expect(gameState.turns).toBe(initialTurns);
      
      // Check return value indicates no movement
      expect(result).toEqual({ newPlayerX: initialPos.x, newPlayerY: initialPos.y });
      
      // Check message was added
      expect(addMessage).toHaveBeenCalledWith("You can't move there!", gameState, gameState.player);
    });

    test('should block movement through furniture', () => {
      const initialPos = gameState.getPlayerPosition();
      const initialTurns = gameState.turns;
      
      // Add impassible furniture at target position
      const furnitureData = { name: 'Boulder', symbol: 'O', impassible: true };
      const furniture = new Furniture(4, 3, 'boulder', furnitureData);
      gameState.currentLevel.furniture.push(furniture);
      
      // Try to move to furniture position
      const result = movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      // Check position didn't change
      expect(gameState.getPlayerPosition().x).toBe(initialPos.x);
      expect(gameState.getPlayerPosition().y).toBe(initialPos.y);
      
      // Check turns didn't increment
      expect(gameState.turns).toBe(initialTurns);
      
      // Check return value indicates no movement
      expect(result).toEqual({ newPlayerX: initialPos.x, newPlayerY: initialPos.y });
      
      // Check message was added
      expect(addMessage).toHaveBeenCalledWith("You can't move through the Boulder!", gameState, gameState.player);
    });

    test('should show item message when moving to position with item', () => {
      // Add an item at target position
      gameState.currentLevel.addItem(4, 3, 'sword');
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see a Iron Sword here.", gameState, gameState.player);
    });

    test('should show furniture message when moving to position with furniture', () => {
      // Add furniture at target position
      const furnitureData = { name: 'Table', symbol: 'T', impassible: false };
      const furniture = new Furniture(4, 3, 'table', furnitureData);
      gameState.currentLevel.furniture.push(furniture);
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see a Table.", gameState, gameState.player);
    });

    test('should show container information for open containers with items', () => {
      // Add open container with items at target position
      const containerData = {
        name: 'Chest',
        symbol: '=',
        container: { capacity: 5 }
      };
      const container = new Furniture(4, 3, 'chest', containerData);
      container.state = 'open';
      container.addItemToContainer({ name: 'Gold Coin', itemId: 'gold_coin' });
      container.addItemToContainer({ name: 'Silver Coin', itemId: 'silver_coin' });
      gameState.currentLevel.furniture.push(container);
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see a Chest. It contains: Gold Coin, Silver Coin", gameState, gameState.player);
    });

    test('should show empty message for open containers without items', () => {
      // Add empty open container at target position
      const containerData = {
        name: 'Chest',
        symbol: '=',
        container: { capacity: 5 }
      };
      const container = new Furniture(4, 3, 'chest', containerData);
      container.state = 'open';
      gameState.currentLevel.furniture.push(container);
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see a Chest. It is empty.", gameState, gameState.player);
    });

    test('should call render and updateUI after successful movement', () => {
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(render).toHaveBeenCalledWith(gameState, mockGameDisplay);
      expect(updateUI).toHaveBeenCalledWith(gameState, gameState.player, mockChoiceModeManager);
    });

    test('should handle unknown item names gracefully', () => {
      // Add an item with unknown ID at target position
      gameState.currentLevel.addItem(4, 3, 'unknown_item');
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see a Unknown Item here.", gameState, gameState.player);
    });

    test('should handle diagonal movement', () => {
      const initialPos = gameState.getPlayerPosition();
      const initialTurns = gameState.turns;
      
      const result = movePlayer(1, 1, gameState, mockGameDisplay, mockChoiceModeManager);
      
      // Check position changed
      expect(gameState.getPlayerPosition().x).toBe(initialPos.x + 1);
      expect(gameState.getPlayerPosition().y).toBe(initialPos.y + 1);
      
      // Check turns incremented
      expect(gameState.turns).toBe(initialTurns + 1);
      
      // Check return value
      expect(result).toEqual({ newPlayerX: 4, newPlayerY: 4 });
    });

    test('should handle negative movement', () => {
      const initialPos = gameState.getPlayerPosition();
      const initialTurns = gameState.turns;
      
      const result = movePlayer(-1, -1, gameState, mockGameDisplay, mockChoiceModeManager);
      
      // Check position changed
      expect(gameState.getPlayerPosition().x).toBe(initialPos.x - 1);
      expect(gameState.getPlayerPosition().y).toBe(initialPos.y - 1);
      
      // Check turns incremented
      expect(gameState.turns).toBe(initialTurns + 1);
      
      // Check return value
      expect(result).toEqual({ newPlayerX: 2, newPlayerY: 2 });
    });
  });

  describe('useFurniture', () => {
    test('should return false when no furniture at target position', () => {
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith("There's nothing to use there.", gameState, gameState.player);
    });

    test('should return false when furniture is not usable', () => {
      // Add non-usable furniture
      const furnitureData = { name: 'Boulder', symbol: 'O', impassible: true };
      const furniture = new Furniture(4, 3, 'boulder', furnitureData);
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith("You can't use the Boulder.", gameState, gameState.player);
    });

    test('should successfully toggle stateful furniture', () => {
      // Add stateful furniture (door)
      const furnitureData = {
        name: 'Door',
        symbol: '+',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' }
      };
      const furniture = new Furniture(4, 3, 'door', furnitureData);
      furniture.furnitureId = 'door'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(true);
      expect(furniture.state).toBe('open');
      expect(addMessage).toHaveBeenCalledWith("You opened the Door.", gameState, gameState.player);
      expect(render).toHaveBeenCalledWith(gameState, mockGameDisplay);
    });

    test('should toggle furniture from open to closed', () => {
      // Add stateful furniture that starts open
      const furnitureData = {
        name: 'Door',
        symbol: '+',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'open',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' }
      };
      const furniture = new Furniture(4, 3, 'door', furnitureData);
      furniture.furnitureId = 'door'; // Set the correct ID
      furniture.state = 'open';
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(true);
      expect(furniture.state).toBe('closed');
      expect(addMessage).toHaveBeenCalledWith("You closed the Door.", gameState, gameState.player);
    });

    test('should handle container furniture with items when opening', () => {
      // Add container furniture with items
      const furnitureData = {
        name: 'Chest',
        symbol: '=',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' },
        container: { capacity: 5 }
      };
      const furniture = new Furniture(4, 3, 'chest', furnitureData);
      furniture.furnitureId = 'chest'; // Set the correct ID
      furniture.addItemToContainer({ name: 'Gold Coin', itemId: 'gold_coin' });
      furniture.addItemToContainer({ name: 'Silver Coin', itemId: 'silver_coin' });
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(true);
      expect(furniture.state).toBe('open');
      expect(addMessage).toHaveBeenCalledWith("You opened the Chest. (2/5 items) You see: Gold Coin, Silver Coin", gameState, gameState.player);
    });

    test('should handle empty container when opening', () => {
      // Add empty container furniture
      const furnitureData = {
        name: 'Chest',
        symbol: '=',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' },
        container: { capacity: 5 }
      };
      const furniture = new Furniture(4, 3, 'chest', furnitureData);
      furniture.furnitureId = 'chest'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(true);
      expect(furniture.state).toBe('open');
      expect(addMessage).toHaveBeenCalledWith("You opened the Chest. (0/5 items) It is empty.", gameState, gameState.player);
    });

    test('should return false when toggle state fails', () => {
      // Add furniture that can't toggle (no states defined)
      const furnitureData = { 
        name: 'Broken Door', 
        symbol: '+', 
        stateful: true,
        states: [],
        defaultState: 'closed',
        usable: { action: 'toggle_state' }
      };
      const furniture = new Furniture(4, 3, 'broken_door', furnitureData);
      furniture.furnitureId = 'broken_door'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith("You can't toggle the Broken Door.", gameState, gameState.player);
    });

    test('should handle unknown action types', () => {
      // Add furniture with unknown action
      const furnitureData = { name: 'Mystery Box', symbol: '?', usable: { action: 'unknown_action' } };
      const furniture = new Furniture(4, 3, 'mystery_box', furnitureData);
      furniture.furnitureId = 'mystery_box'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith("You don't know how to use the Mystery Box.", gameState, gameState.player);
    });

    test('should call onUIUpdate callback when provided', () => {
      const mockOnUIUpdate = jest.fn();
      
      // Add furniture at target position
      const furnitureData = {
        name: 'Door',
        symbol: '+',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' }
      };
      const furniture = new Furniture(4, 3, 'door', furnitureData);
      furniture.furnitureId = 'door'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      const result = useFurniture(1, 0, gameState, mockGameDisplay, mockOnUIUpdate);
      
      expect(result).toBe(true);
      expect(mockOnUIUpdate).toHaveBeenCalled();
    });

    test('should call onUIUpdate callback even on failure', () => {
      const mockOnUIUpdate = jest.fn();
      
      // Try to use furniture that doesn't exist
      const result = useFurniture(1, 0, gameState, mockGameDisplay, mockOnUIUpdate);
      
      expect(result).toBe(false);
      expect(mockOnUIUpdate).toHaveBeenCalled();
    });

    test('should calculate target position correctly from player position', () => {
      // Add furniture at a specific offset position
      const furnitureData = {
        name: 'Door',
        symbol: '+',
        impassible: false,
        stateful: true,
        states: ['closed', 'open'],
        defaultState: 'closed',
        impassibleWhen: ['closed'],
        usable: { action: 'toggle_state' }
      };
      const furniture = new Furniture(2, 2, 'door', furnitureData); // Position (2, 2)
      furniture.furnitureId = 'door'; // Set the correct ID
      gameState.currentLevel.furniture.push(furniture);
      
      // Player is at (3, 3), so (-1, -1) should target (2, 2)
      const result = useFurniture(-1, -1, gameState, mockGameDisplay);
      
      expect(result).toBe(true);
      expect(furniture.state).toBe('open');
    });
  });
}); 