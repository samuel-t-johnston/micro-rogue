import { pickUpItem, movePlayer, useFurniture, getAvailableEquipment, equipItemByIndex, equipItemWithReplacement, getEquippedItems, removeEquipmentByIndex, removeEquipmentWithDrop, dropItemFromInventory, dropItemWithContainerCheck } from '../src/js/core/gameLogic.js';
import { GameState } from '../src/js/core/gameState.js';
import { Furniture } from '../src/js/entities/furniture.js';

// Mock dependencies
jest.mock('../src/js/systems/renderer.js', () => ({
  render: jest.fn(),
}));

jest.mock('../src/js/ui/ui.js', () => ({
  addMessage: jest.fn(),
  updateUI: jest.fn(),
}));

jest.mock('../src/js/core/world.js', () => ({
  initializeWorld: jest.fn(),
  placeItems: jest.fn(),
  placeFurniture: jest.fn(),
}));

// Import mocked modules
const { addMessage, updateUI } = require('../src/js/ui/ui.js');
const { render } = require('../src/js/systems/renderer.js');

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
      'leather_helm': { name: 'Leather Helm', type: 'armor', equipment: { slot: 'head' } },
      'leather_armor': { name: 'Leather Armor', type: 'armor', equipment: { slot: 'body' } },
      'ring_power': { name: 'Ring of Power', type: 'ring', equipment: { slot: 'rings' } },
      'iron_helm': { name: 'Iron Helm', type: 'armor', equipment: { slot: 'head' } },
      'iron_dagger': { name: 'Iron Dagger', type: 'weapon', equipment: { slot: 'weapon', effect: 'attack+1' } }
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

    test('should show multiple items message when moving to position with multiple items', () => {
      // Add multiple items at target position
      gameState.currentLevel.addItem(4, 3, 'iron_dagger');
      gameState.currentLevel.addItem(4, 3, 'iron_dagger');
      
      movePlayer(1, 0, gameState, mockGameDisplay, mockChoiceModeManager);
      
      expect(addMessage).toHaveBeenCalledWith("You see: Iron Dagger, Iron Dagger", gameState, gameState.player);
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

  describe('getAvailableEquipment', () => {
    test('should return equipment items from inventory', () => {
      // Add equipment items to inventory
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      const armor = { name: 'Leather Armor', itemId: 'leather_armor', equipment: { slot: 'body' } };
      const potion = { name: 'Potion', itemId: 'potion', usable: { use_effect: 'heal' } };
      
      gameState.player.addToInventory(helmet);
      gameState.player.addToInventory(armor);
      gameState.player.addToInventory(potion);
      
      const availableEquipment = getAvailableEquipment(gameState);
      
      expect(availableEquipment).toHaveLength(2);
      expect(availableEquipment).toContain(helmet);
      expect(availableEquipment).toContain(armor);
      expect(availableEquipment).not.toContain(potion);
    });

    test('should exclude rings from equipment list', () => {
      // Add equipment items including rings
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      const ring = { name: 'Ring of Power', itemId: 'ring_power', equipment: { slot: 'rings' } };
      
      gameState.player.addToInventory(helmet);
      gameState.player.addToInventory(ring);
      
      const availableEquipment = getAvailableEquipment(gameState);
      
      expect(availableEquipment).toHaveLength(1);
      expect(availableEquipment).toContain(helmet);
      expect(availableEquipment).not.toContain(ring);
    });

    test('should return empty array when no equipment in inventory', () => {
      const availableEquipment = getAvailableEquipment(gameState);
      expect(availableEquipment).toHaveLength(0);
    });
  });

  describe('equipItemByIndex', () => {
    test('should equip item when slot is empty', () => {
      // Add equipment to inventory
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      gameState.player.addToInventory(helmet);
      
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemByIndex(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.head).toEqual(helmet);
      expect(gameState.player.inventory).not.toContain(helmet);
      expect(addMessage).toHaveBeenCalledWith("Equipped Leather Helm in head slot.", gameState, gameState.player);
    });

    test('should enter YN mode when slot is occupied', () => {
      // Add equipment to inventory
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      gameState.player.addToInventory(helmet);
      
      // Equip existing item in head slot
      const existingHelmet = { name: 'Iron Helm', itemId: 'iron_helm', equipment: { slot: 'head' } };
      gameState.player.equipItem(existingHelmet, 'head');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemByIndex(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(mockModeManager.setMode).toHaveBeenCalledWith('yn', {
        action: 'equip',
        itemIndex: 0,
        newItem: helmet,
        existingItem: existingHelmet,
        slot: 'head'
      });
    });

    test('should return false for invalid item index', () => {
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemByIndex(5, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith('Invalid equipment selection.', gameState, gameState.player);
    });
  });

  describe('equipItemWithReplacement', () => {
    test('should replace equipment and add old item to inventory', () => {
      // Add equipment to inventory
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      gameState.player.addToInventory(helmet);
      
      // Equip existing item in head slot
      const existingHelmet = { name: 'Iron Helm', itemId: 'iron_helm', equipment: { slot: 'head' } };
      gameState.player.equipItem(existingHelmet, 'head');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemWithReplacement(0, existingHelmet, 'head', gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.head).toEqual(helmet);
      expect(gameState.player.inventory).toContain(existingHelmet);
      expect(gameState.player.inventory).not.toContain(helmet);
      expect(addMessage).toHaveBeenCalledWith("Unequipped Iron Helm and added to inventory.", gameState, gameState.player);
      expect(addMessage).toHaveBeenCalledWith("Equipped Leather Helm in head slot.", gameState, gameState.player);
    });

    test('should drop old item when inventory is full', () => {
      // Fill inventory to capacity (5 items)
      for (let i = 0; i < 5; i++) {
        gameState.player.addToInventory({ name: `Item ${i}`, type: 'misc' });
      }
      
      // Add equipment to inventory (this should fail since inventory is full)
      const helmet = { name: 'Leather Helm', itemId: 'leather_helm', equipment: { slot: 'head' } };
      const added = gameState.player.addToInventory(helmet);
      expect(added).toBe(false); // Should not be able to add more items
      
      // Manually add the helmet to inventory for the test (simulating a full inventory scenario)
      gameState.player.inventory.push(helmet);
      
      // Equip existing item in head slot
      const existingHelmet = { name: 'Iron Helm', itemId: 'iron_helm', equipment: { slot: 'head' } };
      gameState.player.equipItem(existingHelmet, 'head');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemWithReplacement(0, existingHelmet, 'head', gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.head).toEqual(helmet);
      expect(addMessage).toHaveBeenCalledWith("Unequipped Iron Helm (inventory full, item dropped).", gameState, gameState.player);
    });

    test('should return false for invalid item index', () => {
      const mockModeManager = { setMode: jest.fn() };
      const result = equipItemWithReplacement(5, null, 'head', gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith('Invalid equipment selection.', gameState, gameState.player);
    });
  });

  describe('getEquippedItems', () => {
    test('should return equipped items from player', () => {
      // Equip some items
      const weapon = { name: 'Sword', itemId: 'sword' };
      const helmet = { name: 'Helmet', itemId: 'helmet' };
      
      gameState.player.equipItem(weapon, 'weapon1');
      gameState.player.equipItem(helmet, 'head');
      
      const equippedItems = getEquippedItems(gameState);
      
      expect(equippedItems).toHaveLength(2);
      expect(equippedItems[0].item).toEqual(weapon);
      expect(equippedItems[0].slot).toBe('weapon1');
      expect(equippedItems[1].item).toEqual(helmet);
      expect(equippedItems[1].slot).toBe('head');
    });

    test('should return empty array when no items equipped', () => {
      const equippedItems = getEquippedItems(gameState);
      expect(equippedItems).toHaveLength(0);
    });
  });

  describe('removeEquipmentByIndex', () => {
    test('should remove equipment and add to inventory when space available', () => {
      // Equip an item
      const weapon = { name: 'Sword', itemId: 'sword' };
      gameState.player.equipItem(weapon, 'weapon1');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = removeEquipmentByIndex(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.weapon1).toBe(null);
      expect(gameState.player.inventory).toContain(weapon);
      expect(addMessage).toHaveBeenCalledWith('Removed Sword and added to inventory.', gameState, gameState.player);
    });

    test('should enter YN mode when inventory is full', () => {
      // Fill inventory
      for (let i = 0; i < 5; i++) {
        gameState.player.addToInventory({ name: `Item ${i}`, itemId: `item${i}` });
      }
      
      // Equip an item
      const weapon = { name: 'Sword', itemId: 'sword' };
      gameState.player.equipItem(weapon, 'weapon1');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = removeEquipmentByIndex(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(mockModeManager.setMode).toHaveBeenCalledWith('yn', {
        action: 'drop_equipment',
        item: weapon,
        slot: 'weapon1',
        ringIndex: null
      });
    });

    test('should return false for invalid item index', () => {
      const mockModeManager = { setMode: jest.fn() };
      const result = removeEquipmentByIndex(5, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith('Invalid equipment selection.', gameState, gameState.player);
    });
  });

  describe('removeEquipmentWithDrop', () => {
    test('should remove equipment and drop it on the ground', () => {
      const weapon = { name: 'Sword', itemId: 'sword' };
      
      // First equip the weapon
      gameState.player.equipItem(weapon, 'weapon1');
      
      const mockModeManager = { setMode: jest.fn() };
      
      const result = removeEquipmentWithDrop(weapon, 'weapon1', null, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.weapon1).toBe(null);
      expect(addMessage).toHaveBeenCalledWith('Removed Sword and dropped it on the ground.', gameState, gameState.player);
      
      // Check that item was added to level
      const playerPos = gameState.getPlayerPosition();
      const itemAtPosition = gameState.currentLevel.getItemAt(playerPos.x, playerPos.y);
      expect(itemAtPosition).toBeDefined();
      expect(itemAtPosition.itemId).toBe('sword');
    });

    test('should handle ring equipment correctly', () => {
      const ring = { name: 'Ring', itemId: 'ring' };
      gameState.player.equipItem(ring, 'rings');
      
      const mockModeManager = { setMode: jest.fn() };
      const result = removeEquipmentWithDrop(ring, 'rings', 0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.equipment.rings[0]).toBe(null);
    });
  });

  describe('dropItemFromInventory', () => {
    test('should drop item on ground when no container present', () => {
      // Add item to inventory
      const item = { name: 'Sword', itemId: 'sword' };
      gameState.player.addToInventory(item);
      
      const mockModeManager = { setMode: jest.fn() };
      const result = dropItemFromInventory(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.inventory).not.toContain(item);
      
      // Check that item was added to level
      const playerPos = gameState.getPlayerPosition();
      const itemAtPosition = gameState.currentLevel.getItemAt(playerPos.x, playerPos.y);
      expect(itemAtPosition).toBeDefined();
      expect(itemAtPosition.itemId).toBe('sword');
      
      expect(addMessage).toHaveBeenCalledWith('Dropped Sword on the ground.', gameState, gameState.player);
    });

    test('should enter YN mode when container is present', () => {
      // Add item to inventory
      const item = { name: 'Sword', itemId: 'sword' };
      gameState.player.addToInventory(item);
      
      // Add container furniture at player position
      const playerPos = gameState.getPlayerPosition();
      const furnitureData = {
        name: 'Chest',
        symbol: 'C',
        container: { capacity: 5 },
        defaultState: 'closed',
        stateful: true,
        states: ['closed', 'open']
      };
      const container = gameState.currentLevel.addFurniture(playerPos.x, playerPos.y, 'chest', furnitureData);
      
      const mockModeManager = { setMode: jest.fn() };
      const result = dropItemFromInventory(0, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(mockModeManager.setMode).toHaveBeenCalledWith('yn', {
        action: 'place_in_container',
        item: item,
        itemIndex: 0,
        furniture: container
      });
    });

    test('should return false for invalid item index', () => {
      const mockModeManager = { setMode: jest.fn() };
      const result = dropItemFromInventory(5, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith('Invalid item selection.', gameState, gameState.player);
    });
  });

  describe('dropItemWithContainerCheck', () => {
    test('should place item in container when furniture is provided', () => {
      const item = { name: 'Sword', itemId: 'sword' };
      gameState.player.addToInventory(item);
      
      const furnitureData = {
        name: 'Chest',
        symbol: 'C',
        container: { capacity: 5 },
        defaultState: 'closed',
        stateful: true,
        states: ['closed', 'open']
      };
      const container = new Furniture(0, 0, 'chest', furnitureData);
      const mockModeManager = { setMode: jest.fn() };
      
      const result = dropItemWithContainerCheck(item, 0, container, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.inventory).not.toContain(item);
      expect(container.getContainerItems()).toContain(item);
      expect(addMessage).toHaveBeenCalledWith('Placed Sword in Chest.', gameState, gameState.player);
    });

    test('should drop item on ground when furniture is full', () => {
      const item = { name: 'Sword', itemId: 'sword' };
      gameState.player.addToInventory(item);
      
      const furnitureData = {
        name: 'Chest',
        symbol: 'C',
        container: { capacity: 1 },
        defaultState: 'closed',
        stateful: true,
        states: ['closed', 'open']
      };
      const container = new Furniture(0, 0, 'chest', furnitureData);
      // Fill the container
      container.addItemToContainer({ name: 'Other Item', itemId: 'other' });
      
      const mockModeManager = { setMode: jest.fn() };
      
      const result = dropItemWithContainerCheck(item, 0, container, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.inventory).not.toContain(item);
      expect(container.getContainerItems()).not.toContain(item);
      
      // Check that item was dropped on ground
      const playerPos = gameState.getPlayerPosition();
      const itemAtPosition = gameState.currentLevel.getItemAt(playerPos.x, playerPos.y);
      expect(itemAtPosition).toBeDefined();
      expect(itemAtPosition.itemId).toBe('sword');
      
      expect(addMessage).toHaveBeenCalledWith('The Chest is full. Dropped Sword on the ground.', gameState, gameState.player);
    });

    test('should drop item on ground when no furniture provided', () => {
      const item = { name: 'Sword', itemId: 'sword' };
      gameState.player.addToInventory(item);
      
      const mockModeManager = { setMode: jest.fn() };
      
      const result = dropItemWithContainerCheck(item, 0, null, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(true);
      expect(gameState.player.inventory).not.toContain(item);
      
      // Check that item was dropped on ground
      const playerPos = gameState.getPlayerPosition();
      const itemAtPosition = gameState.currentLevel.getItemAt(playerPos.x, playerPos.y);
      expect(itemAtPosition).toBeDefined();
      expect(itemAtPosition.itemId).toBe('sword');
      
      expect(addMessage).toHaveBeenCalledWith('Dropped Sword on the ground.', gameState, gameState.player);
    });

    test('should return false when item removal fails', () => {
      const item = { name: 'Sword', itemId: 'sword' };
      // Don't add item to inventory
      
      const mockModeManager = { setMode: jest.fn() };
      
      const result = dropItemWithContainerCheck(item, 0, null, gameState, mockGameDisplay, mockModeManager);
      
      expect(result).toBe(false);
      expect(addMessage).toHaveBeenCalledWith('Failed to remove item from inventory.', gameState, gameState.player);
    });
  });
}); 