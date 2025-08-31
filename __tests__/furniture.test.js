import { Furniture } from '../src/js/entities/furniture.js';

describe('Furniture', () => {
  let boulderData, doorData, chestData;

  beforeEach(() => {
    boulderData = {
      name: 'Boulder',
      symbol: 'O',
      impassible: true
    };

    doorData = {
      name: 'Door',
      symbol: '+',
      impassible: false,
      stateful: true,
      states: ['closed', 'open'],
      defaultState: 'closed',
      impassibleWhen: ['closed'],
      usable: {
        action: 'toggle_state'
      }
    };

    chestData = {
      name: 'Heavy Chest',
      symbol: '=',
      impassible: false,
      stateful: true,
      states: ['closed', 'open'],
      defaultState: 'closed',
      impassibleWhen: ['closed'],
      usable: {
        action: 'toggle_state'
      },
      container: {
        capacity: 5
      }
    };
  });

  describe('constructor', () => {
    test('should create furniture with basic properties', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      
      expect(furniture.x).toBe(5);
      expect(furniture.y).toBe(3);
      expect(furniture.furnitureId).toBe('boulder');
      expect(furniture.state).toBeNull();
      expect(furniture.containerItems).toBeNull();
      expect(furniture.data).toBe(boulderData);
    });

    test('should set default state for stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      
      expect(furniture.state).toBe('closed');
    });

    test('should initialize container items for container furniture', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      
      expect(furniture.containerItems).toEqual([]);
    });
  });

  describe('getName', () => {
    test('should return furniture name', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getName()).toBe('Boulder');
    });

    test('should return unknown furniture for missing name', () => {
      const furniture = new Furniture(5, 3, 'unknown', {});
      expect(furniture.getName()).toBe('Unknown Furniture');
    });
  });

  describe('getSymbol', () => {
    test('should return furniture symbol', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getSymbol()).toBe('O');
    });

    test('should return default symbol for missing symbol', () => {
      const furniture = new Furniture(5, 3, 'unknown', {});
      expect(furniture.getSymbol()).toBe('F');
    });
  });

  describe('isStateful', () => {
    test('should return true for stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      expect(furniture.isStateful()).toBe(true);
    });

    test('should return false for non-stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.isStateful()).toBe(false);
    });
  });

  describe('isContainer', () => {
    test('should return true for container furniture', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      expect(furniture.isContainer()).toBe(true);
    });

    test('should return false for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.isContainer()).toBe(false);
    });
  });

  describe('isUsable', () => {
    test('should return true for usable furniture', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      expect(furniture.isUsable()).toBe(true);
    });

    test('should return false for non-usable furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.isUsable()).toBe(false);
    });
  });

  describe('getStateDescription', () => {
    test('should return name with state for stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      expect(furniture.getStateDescription()).toBe('Door (closed)');
    });

    test('should return just name for non-stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getStateDescription()).toBe('Boulder');
    });
  });

  describe('toggleState', () => {
    test('should toggle state for stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      
      expect(furniture.state).toBe('closed');
      expect(furniture.toggleState()).toBe(true);
      expect(furniture.state).toBe('open');
      expect(furniture.toggleState()).toBe(true);
      expect(furniture.state).toBe('closed');
    });

    test('should return false for non-stateful furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.toggleState()).toBe(false);
    });

    test('should return false for stateful furniture without states', () => {
      const furniture = new Furniture(5, 3, 'broken', { stateful: true });
      expect(furniture.toggleState()).toBe(false);
    });
  });

  describe('isPassible', () => {
    test('should return false for always impassible furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.isPassible()).toBe(false);
    });

    test('should return false for stateful furniture in impassible state', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      expect(furniture.isPassible()).toBe(false); // closed by default
    });

    test('should return true for stateful furniture in passible state', () => {
      const furniture = new Furniture(5, 3, 'door', doorData);
      furniture.toggleState(); // open the door
      expect(furniture.isPassible()).toBe(true);
    });

    test('should return true for passible furniture', () => {
      const passibleData = { name: 'Table', symbol: 'T', impassible: false };
      const furniture = new Furniture(5, 3, 'table', passibleData);
      expect(furniture.isPassible()).toBe(true);
    });
  });

  describe('addItemToContainer', () => {
    test('should add item to container', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      const item = { name: 'Gold Coin', itemId: 'gold_coin' };
      
      expect(furniture.addItemToContainer(item)).toBe(true);
      expect(furniture.containerItems).toHaveLength(1);
      expect(furniture.containerItems[0]).toBe(item);
    });

    test('should return false for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      const item = { name: 'Gold Coin', itemId: 'gold_coin' };
      
      expect(furniture.addItemToContainer(item)).toBe(false);
    });

    test('should return false when container is full', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      const item = { name: 'Gold Coin', itemId: 'gold_coin' };
      
      // Fill the container
      for (let i = 0; i < 5; i++) {
        furniture.addItemToContainer({ name: `Item ${i}`, itemId: `item_${i}` });
      }
      
      expect(furniture.addItemToContainer(item)).toBe(false);
    });
  });

  describe('removeItemFromContainer', () => {
    test('should remove item from container', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      const item = { name: 'Gold Coin', itemId: 'gold_coin' };
      
      furniture.addItemToContainer(item);
      const removedItem = furniture.removeItemFromContainer(0);
      
      expect(removedItem).toBe(item);
      expect(furniture.containerItems).toHaveLength(0);
    });

    test('should return null for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.removeItemFromContainer(0)).toBeNull();
    });

    test('should return null for invalid index', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      expect(furniture.removeItemFromContainer(0)).toBeNull();
      expect(furniture.removeItemFromContainer(-1)).toBeNull();
      expect(furniture.removeItemFromContainer(5)).toBeNull();
    });
  });

  describe('getContainerItems', () => {
    test('should return container items array', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      const item1 = { name: 'Gold Coin', itemId: 'gold_coin' };
      const item2 = { name: 'Silver Coin', itemId: 'silver_coin' };
      furniture.addItemToContainer(item1);
      furniture.addItemToContainer(item2);

      expect(furniture.getContainerItems()).toEqual([item1, item2]);
    });

    test('should return empty array for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getContainerItems()).toEqual([]);
    });
  });

  describe('getContainerCapacity', () => {
    test('should return container capacity', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      expect(furniture.getContainerCapacity()).toBe(5);
    });

    test('should return 0 for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getContainerCapacity()).toBe(0);
    });
  });

  describe('getContainerStatus', () => {
    test('should return status for container with items', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      const item1 = { name: 'Gold Coin', itemId: 'gold_coin' };
      const item2 = { name: 'Silver Coin', itemId: 'silver_coin' };
      furniture.addItemToContainer(item1);
      furniture.addItemToContainer(item2);

      expect(furniture.getContainerStatus()).toBe('(2/5 items)');
    });

    test('should return status for empty container', () => {
      const furniture = new Furniture(5, 3, 'chest', chestData);
      expect(furniture.getContainerStatus()).toBe('(0/5 items)');
    });

    test('should return null for non-container furniture', () => {
      const furniture = new Furniture(5, 3, 'boulder', boulderData);
      expect(furniture.getContainerStatus()).toBeNull();
    });
  });
});
