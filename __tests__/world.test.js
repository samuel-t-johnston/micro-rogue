import { initializeWorld, placeRandomItems } from '../src/js/core/world.js';
import { DungeonLevel } from '../src/js/core/gameState.js';
import { CONFIG_SETTINGS } from '../src/js/utils/config.js';

// Mock the config for testing
jest.mock('../src/js/utils/config.js', () => ({
  CONFIG_SETTINGS: {
    viewportWidth: 51,
    viewportHeight: 13,
  },
}));

// Mock the LevelLoader
jest.mock('../src/js/systems/levelLoader.js', () => ({
  LevelLoader: jest.fn().mockImplementation(() => ({
    loadLevel: jest.fn().mockResolvedValue({
      width: 11,
      height: 11,
      playerStart: [5, 5],
      map: [
        ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
        ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#']
      ],
      items: new Map([
        ['1,1', ['sword']],
        ['2,1', ['potion']],
        ['1,2', ['shield']]
      ]),
      furniture: [
        { type: 'heavy_chest', x: 9, y: 9 }
      ]
    })
  }))
}));

describe('World Generation', () => {
  describe('initializeWorld', () => {
    it('should create world map with correct dimensions', async () => {
      const levelData = await initializeWorld();
      expect(levelData.map).toHaveLength(11);
      expect(levelData.map[0]).toHaveLength(11);
    });

    it('should create room with walls around perimeter', async () => {
      const levelData = await initializeWorld();
      const worldMap = levelData.map;
      
      // Check top and bottom walls
      for (let x = 0; x < 11; x++) {
        expect(worldMap[0][x]).toBe('#');
        expect(worldMap[10][x]).toBe('#');
      }
      
      // Check left and right walls
      for (let y = 0; y < 11; y++) {
        expect(worldMap[y][0]).toBe('#');
        expect(worldMap[y][10]).toBe('#');
      }
    });

    it('should create floor tiles inside room', async () => {
      const levelData = await initializeWorld();
      const worldMap = levelData.map;
      
      // Check interior tiles are floor
      for (let y = 1; y < 10; y++) {
        for (let x = 1; x < 10; x++) {
          expect(worldMap[y][x]).toBe('.');
        }
      }
    });

    it('should only create room-sized map', async () => {
      const levelData = await initializeWorld();
      expect(levelData.map).toHaveLength(11);
      expect(levelData.map[0]).toHaveLength(11);
    });
  });

  describe('placeRandomItems', () => {
    it('should place items in dungeon level', async () => {
      const itemsData = {
        'sword': { name: 'Sword', type: 'weapon' },
        'potion': { name: 'Potion', type: 'consumable' }
      };
      
      const dungeonLevel = new DungeonLevel(1, 11, 11);
      dungeonLevel.playerPosition = { x: 5, y: 5 }; // Player not in item placement area
      
      // Initialize world first to set up loadedLevelData
      await initializeWorld();
      
      placeRandomItems(itemsData, dungeonLevel);
      
      expect(dungeonLevel.items.length).toBeGreaterThan(0);
      expect(dungeonLevel.items.length).toBeLessThanOrEqual(3);
    });

    it('should not place items if no items data', async () => {
      const dungeonLevel = new DungeonLevel(1, 11, 11);
      
      // Initialize world first to set up loadedLevelData
      await initializeWorld();
      
      // Test with empty items data - should still place items from level data
      placeRandomItems({}, dungeonLevel);
      
      // Since the mock level has items defined, they should be placed
      // This tests that the function works with the new file-based system
      expect(dungeonLevel.items.length).toBeGreaterThan(0);
    });

    it('should skip placement if player is in item area', async () => {
      const itemsData = {
        'sword': { name: 'Sword', type: 'weapon' }
      };
      
      const dungeonLevel = new DungeonLevel(1, 11, 11);
      dungeonLevel.playerPosition = { x: 1, y: 1 }; // Player in item placement area
      
      // Initialize world first to set up loadedLevelData
      await initializeWorld();
      
      placeRandomItems(itemsData, dungeonLevel);
      
      // Should place fewer items since player position is skipped
      expect(dungeonLevel.items.length).toBeLessThanOrEqual(2);
      const playerItem = dungeonLevel.getItemAt(1, 1);
      expect(playerItem).toBeUndefined();
    });
  });
}); 