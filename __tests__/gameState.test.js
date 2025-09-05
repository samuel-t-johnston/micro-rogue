import { GameState, DungeonLevel } from '../src/js/core/gameState.js';
import { Character } from '../src/js/entities/character.js';
import { create } from '../src/js/utils/coordinates.js';

describe('GameState Character System', () => {
  let gameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe('Player Character Management', () => {
    test('should create player character with correct properties', () => {
      expect(gameState.player).toBeInstanceOf(Character);
      expect(gameState.player.isPlayer).toBe(true);
      expect(gameState.player.symbol).toBe('@');
      expect(gameState.player.x).toBe(0);
      expect(gameState.player.y).toBe(0);
    });

    test('should get player position from character coordinates', () => {
      // Initialize level first so player position can be set
      gameState.initializeLevel(1, 10, 10, 5, 7);
      
      const position = gameState.getPlayerPosition();
      expect(position).toEqual(create(5, 7));
    });

    test('should return default position when no current level', () => {
      gameState.currentLevel = null;
      
      const position = gameState.getPlayerPosition();
      expect(position).toEqual(create(0, 0));
    });

    test('should set player position by moving character', () => {
      gameState.initializeLevel(1, 10, 10, 3, 4);
      
      gameState.setPlayerPosition(6, 8);
      
      expect(gameState.player.x).toBe(6);
      expect(gameState.player.y).toBe(8);
      expect(gameState.currentLevel.getCharacterAt(6, 8)).toBe(gameState.player);
    });

    test('should not set position when no current level', () => {
      gameState.currentLevel = null;
      gameState.player.moveTo(1, 1);
      
      gameState.setPlayerPosition(5, 5);
      
      // Position should not change when no level
      expect(gameState.player.x).toBe(1);
      expect(gameState.player.y).toBe(1);
    });
  });

  describe('Level Initialization', () => {
    test('should initialize level with player character', () => {
      gameState.initializeLevel(2, 15, 12, 7, 9);
      
      expect(gameState.currentLevel).toBeInstanceOf(DungeonLevel);
      expect(gameState.currentLevel.levelNumber).toBe(2);
      expect(gameState.currentLevel.width).toBe(15);
      expect(gameState.currentLevel.height).toBe(12);
      expect(gameState.currentLevel.characters).toContain(gameState.player);
      expect(gameState.player.x).toBe(7);
      expect(gameState.player.y).toBe(9);
    });

    test('should add player character to level characters array', () => {
      gameState.initializeLevel(1, 10, 10, 5, 5);
      
      const playerInLevel = gameState.currentLevel.characters.find(char => char.isPlayer);
      expect(playerInLevel).toBe(gameState.player);
      expect(gameState.currentLevel.getCharacterAt(5, 5)).toBe(gameState.player);
    });
  });

  describe('Game Reset', () => {
    test('should reset game state with new player character', () => {
      // Initialize level first
      gameState.initializeLevel(1, 10, 10, 5, 5);
      
      // Modify the current player
      gameState.player.moveTo(10, 10);
      gameState.player.takeDamage(5);
      gameState.score = 100;
      gameState.turns = 50;
      
      gameState.reset();
      
      // Should create new player character
      // Note: reset() calls initializeLevel(1, 11, 11) which places player at (5,5) by default
      expect(gameState.player.x).toBe(5);
      expect(gameState.player.y).toBe(5);
      expect(gameState.player.isPlayer).toBe(true);
      expect(gameState.player.currentHp).toBe(gameState.player.maxHp);
      expect(gameState.score).toBe(0);
      expect(gameState.turns).toBe(0);
      expect(gameState.messages).toEqual([]);
    });

    test('should initialize new level after reset', () => {
      gameState.reset();
      
      expect(gameState.currentLevel).toBeInstanceOf(DungeonLevel);
      expect(gameState.currentLevel.characters).toContain(gameState.player);
    });
  });

  describe('Player Character Reference Consistency', () => {
    test('should maintain same player character reference', () => {
      const originalPlayer = gameState.player;
      
      gameState.initializeLevel(1, 10, 10, 5, 5);
      
      expect(gameState.player).toBe(originalPlayer);
      expect(gameState.currentLevel.characters).toContain(originalPlayer);
    });

    test('should have player character in level characters array', () => {
      gameState.initializeLevel(1, 10, 10, 3, 4);
      
      const playerInLevel = gameState.currentLevel.getCharacterAt(3, 4);
      expect(playerInLevel).toBe(gameState.player);
      expect(playerInLevel.isPlayer).toBe(true);
    });
  });
});
