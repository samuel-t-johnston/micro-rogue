import { SaveSystem } from '../src/js/systems/saveSystem.js';
import { GameState, DungeonLevel } from '../src/js/core/gameState.js';
import { Character } from '../src/js/entities/character.js';
import { Furniture } from '../src/js/entities/furniture.js';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('SaveSystem', () => {
  let saveSystem;
  let gameState;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create fresh instances
    saveSystem = new SaveSystem();
    gameState = new GameState();
    
    // Set up a test game state
    gameState.score = 150;
    gameState.turns = 25;
    gameState.messages = ['Test message 1', 'Test message 2'];
    gameState.initializeLevel(1, 10, 10, 5, 5);
    
    // Add some test data
    gameState.itemsData = {
      'sword': { name: 'Sword', symbol: 'S' },
      'potion': { name: 'Potion', symbol: 'P' }
    };
    gameState.furnitureData = {
      'chest': { name: 'Chest', symbol: 'C' }
    };
  });

  describe('Character Serialization', () => {
    test('should serialize character with all properties', () => {
      const character = new Character(2, 3, 4, 1, 5, 'G', 7, 8, false);
      character.currentHp = 8;
      character.inventory = [{ name: 'Item', type: 'weapon' }];
      character.equipment.weapon1 = { name: 'Sword', type: 'weapon' };
      
      const serialized = saveSystem.serializeCharacter(character);
      
      expect(serialized).toEqual({
        baseStats: {
          body: 2,
          mind: 3,
          agility: 4,
          control: 1,
          hpBonus: 5,
          guard: 0,
          attack: 0
        },
        bonusedStats: {
          body: 2,
          mind: 3,
          agility: 4,
          control: 1,
          hpBonus: 5,
          guard: 0,
          attack: 0
        },
        symbol: 'G',
        x: 7,
        y: 8,
        isPlayer: false,
        currentHp: 8,
        maxHp: 9, // (2 * 2) + 5
        inventory: [{ name: 'Item', type: 'weapon' }],
        maxInventorySize: 5,
        equipment: expect.objectContaining({
          weapon1: { name: 'Sword', type: 'weapon' }
        }),
        effects: []
      });
    });

    test('should deserialize character correctly', () => {
      const characterData = {
        baseStats: {
          body: 3,
          mind: 2,
          agility: 4,
          control: 1,
          hpBonus: 2,
          guard: 0,
          attack: 0
        },
        bonusedStats: {
          body: 3,
          mind: 2,
          agility: 4,
          control: 1,
          hpBonus: 2,
          guard: 0,
          attack: 0
        },
        symbol: 'O',
        x: 3,
        y: 4,
        isPlayer: true,
        currentHp: 6,
        maxHp: 8,
        inventory: [{ name: 'Test Item', type: 'misc' }],
        maxInventorySize: 5,
        equipment: {
          weapon1: null,
          weapon2: null,
          head: null,
          body: null,
          hands: null,
          legs: null,
          feet: null,
          neck: null,
          rings: new Array(10).fill(null)
        },
        effects: []
      };
      
      const character = saveSystem.deserializeCharacter(characterData);
      
      expect(character).toBeInstanceOf(Character);
      expect(character.bonusedStats.body).toBe(3);
      expect(character.bonusedStats.mind).toBe(2);
      expect(character.bonusedStats.agility).toBe(4);
      expect(character.bonusedStats.control).toBe(1);
      expect(character.bonusedStats.hpBonus).toBe(2);
      expect(character.symbol).toBe('O');
      expect(character.x).toBe(3);
      expect(character.y).toBe(4);
      expect(character.isPlayer).toBe(true);
      expect(character.currentHp).toBe(6);
      expect(character.maxHp).toBe(8);
      expect(character.inventory).toEqual([{ name: 'Test Item', type: 'misc' }]);
    });

    test('should handle missing isPlayer field in deserialization', () => {
      const characterData = {
        baseStats: {
          body: 1,
          mind: 1,
          agility: 1,
          control: 1,
          hpBonus: 0,
          guard: 0,
          attack: 0
        },
        bonusedStats: {
          body: 1,
          mind: 1,
          agility: 1,
          control: 1,
          hpBonus: 0,
          guard: 0,
          attack: 0
        },
        symbol: '@',
        x: 0,
        y: 0,
        // isPlayer field missing
        currentHp: 2,
        maxHp: 2,
        inventory: [],
        maxInventorySize: 5,
        equipment: {},
        effects: []
      };
      
      const character = saveSystem.deserializeCharacter(characterData);
      
      expect(character.isPlayer).toBe(false); // Should default to false
    });
  });

  describe('DungeonLevel Serialization', () => {
    test('should serialize dungeon level with characters', () => {
      const level = new DungeonLevel(2, 15, 12);
      level.map = [['#', '.', '#'], ['.', '.', '.'], ['#', '#', '#']];
      level.items = [{ x: 1, y: 1, itemId: 'sword' }];
      
      const character1 = new Character(1, 1, 1, 1, 0, 'G', 1, 1, false);
      const character2 = new Character(2, 2, 2, 2, 0, 'O', 2, 2, true);
      level.addCharacter(character1, 1, 1);
      level.addCharacter(character2, 2, 2);
      
      const serialized = saveSystem.serializeDungeonLevel(level);
      
      expect(serialized).toEqual({
        levelNumber: 2,
        width: 15,
        height: 12,
        map: [['#', '.', '#'], ['.', '.', '.'], ['#', '#', '#']],
        items: [{ x: 1, y: 1, itemId: 'sword' }],
        furniture: [],
        characters: expect.arrayContaining([
          expect.objectContaining({ symbol: 'G', x: 1, y: 1, isPlayer: false }),
          expect.objectContaining({ symbol: 'O', x: 2, y: 2, isPlayer: true })
        ]),
        playerPosition: expect.any(Object)
      });
    });

    test('should deserialize dungeon level with characters', () => {
      const levelData = {
        levelNumber: 3,
        width: 20,
        height: 15,
        map: [['#', '.', '#'], ['.', '.', '.'], ['#', '#', '#']],
        items: [{ x: 2, y: 2, itemId: 'potion' }],
        furniture: [],
        characters: [
          {
            baseStats: {
              body: 1,
              mind: 1,
              agility: 1,
              control: 1,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            bonusedStats: {
              body: 1,
              mind: 1,
              agility: 1,
              control: 1,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            symbol: 'G',
            x: 1,
            y: 1,
            isPlayer: false,
            currentHp: 2,
            maxHp: 2,
            inventory: [],
            maxInventorySize: 5,
            equipment: {},
            effects: []
          },
          {
            baseStats: {
              body: 2,
              mind: 2,
              agility: 2,
              control: 2,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            bonusedStats: {
              body: 2,
              mind: 2,
              agility: 2,
              control: 2,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            symbol: '@',
            x: 2,
            y: 2,
            isPlayer: true,
            currentHp: 4,
            maxHp: 4,
            inventory: [],
            maxInventorySize: 5,
            equipment: {},
            effects: []
          }
        ],
        playerPosition: { x: 2, y: 2 }
      };
      
      const level = saveSystem.deserializeDungeonLevel(levelData);
      
      expect(level).toBeInstanceOf(DungeonLevel);
      expect(level.levelNumber).toBe(3);
      expect(level.width).toBe(20);
      expect(level.height).toBe(15);
      expect(level.characters).toHaveLength(2);
      
      const npc = level.characters.find(char => char.symbol === 'G');
      const player = level.characters.find(char => char.isPlayer);
      
      expect(npc).toBeDefined();
      expect(npc.x).toBe(1);
      expect(npc.y).toBe(1);
      expect(npc.isPlayer).toBe(false);
      
      expect(player).toBeDefined();
      expect(player.x).toBe(2);
      expect(player.y).toBe(2);
      expect(player.isPlayer).toBe(true);
    });
  });

  describe('Game State Serialization', () => {
    test('should serialize complete game state', () => {
      const serialized = saveSystem.serializeGameState(gameState);
      
      expect(serialized).toEqual({
        version: expect.any(String),
        gameState: {
          score: 150,
          turns: 25,
          messages: ['Test message 1', 'Test message 2'],
          player: expect.objectContaining({
            symbol: '@',
            isPlayer: true
          })
        },
        currentLevel: expect.objectContaining({
          levelNumber: 1,
          characters: expect.arrayContaining([
            expect.objectContaining({ isPlayer: true })
          ])
        }),
        metadata: expect.objectContaining({
          saveDate: expect.any(String),
          gameVersion: expect.any(String)
        })
      });
    });

    test('should deserialize game state correctly', () => {
      const serialized = saveSystem.serializeGameState(gameState);
      const deserialized = saveSystem.deserializeGameState(serialized);
      
      expect(deserialized).toBeInstanceOf(GameState);
      expect(deserialized.score).toBe(150);
      expect(deserialized.turns).toBe(25);
      expect(deserialized.messages).toEqual(['Test message 1', 'Test message 2']);
      expect(deserialized.player).toBeInstanceOf(Character);
      expect(deserialized.player.isPlayer).toBe(true);
      expect(deserialized.currentLevel).toBeInstanceOf(DungeonLevel);
      expect(deserialized.currentLevel.characters).toContain(deserialized.player);
    });

    test('should maintain player character reference consistency', () => {
      const serialized = saveSystem.serializeGameState(gameState);
      const deserialized = saveSystem.deserializeGameState(serialized);
      
      // Player character should be the same object in both gameState.player and level.characters
      const playerInLevel = deserialized.currentLevel.characters.find(char => char.isPlayer);
      expect(playerInLevel).toBe(deserialized.player);
    });
  });

  describe('Save/Load Operations', () => {
    test('should save game to localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = saveSystem.saveGame(gameState);
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'rogue-save',
        expect.stringContaining('"version":')
      );
    });

    test('should load game from localStorage', () => {
      const mockSaveData = JSON.stringify(saveSystem.serializeGameState(gameState));
      localStorageMock.getItem.mockReturnValue(mockSaveData);
      
      const loadedGameState = saveSystem.loadGame();
      
      expect(loadedGameState).toBeInstanceOf(GameState);
      expect(loadedGameState.score).toBe(150);
      expect(loadedGameState.player.isPlayer).toBe(true);
    });

    test('should return null when no save data exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = saveSystem.loadGame();
      
      expect(result).toBeNull();
    });

    test('should check if save data exists', () => {
      localStorageMock.getItem.mockReturnValue('{"version":"1.0.0"}');
      
      const hasData = saveSystem.hasSaveData();
      
      expect(hasData).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('rogue-save');
    });

    test('should delete save data', () => {
      saveSystem.deleteSave();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('rogue-save');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const result = saveSystem.loadGame();
      
      expect(result).toBeNull();
    });

    test('should handle missing required fields gracefully', () => {
      const incompleteData = {
        version: '1.1.0',
        gameState: {
          score: 100,
          turns: 0,
          messages: [],
          player: {
            baseStats: {
              body: 1,
              mind: 1,
              agility: 1,
              control: 1,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            bonusedStats: {
              body: 1,
              mind: 1,
              agility: 1,
              control: 1,
              hpBonus: 0,
              guard: 0,
              attack: 0
            },
            symbol: '@',
            x: 0,
            y: 0,
            isPlayer: true,
            currentHp: 2,
            maxHp: 2,
            inventory: [],
            maxInventorySize: 5,
            equipment: {},
            effects: []
          }
        },
        currentLevel: {
          levelNumber: 1,
          width: 10,
          height: 10,
          map: [['.', '.', '.'], ['.', '.', '.'], ['.', '.', '.']],
          items: [],
          furniture: [],
          characters: [],
          playerPosition: { x: 0, y: 0 }
        }
      };
      
      const result = saveSystem.deserializeGameState(incompleteData);
      
      expect(result).toBeInstanceOf(GameState);
      expect(result.score).toBe(100);
      expect(result.turns).toBe(0); // Should default
      expect(result.messages).toEqual([]); // Should default
    });
  });
});
