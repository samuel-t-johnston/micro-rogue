import { DungeonLevel } from '../src/js/core/gameState.js';
import { Character } from '../src/js/entities/character.js';

describe('DungeonLevel Character Management', () => {
  let level;
  let character1;
  let character2;
  let playerCharacter;

  beforeEach(() => {
    level = new DungeonLevel(1, 10, 10);
    // Initialize the map array
    level.map = Array(10).fill().map(() => Array(10).fill('.'));
    character1 = new Character(2, 2, 2, 2, 0, 'G', 0, 0, false);
    character2 = new Character(3, 3, 3, 3, 0, 'O', 0, 0, false);
    playerCharacter = new Character(1, 1, 1, 1, 0, '@', 0, 0, true);
  });

  describe('Character Position Management', () => {
    test('should add character to level at specific position', () => {
      const result = level.addCharacter(character1, 5, 5);
      
      expect(result).toBe(true);
      expect(level.characters).toContain(character1);
      expect(character1.x).toBe(5);
      expect(character1.y).toBe(5);
    });

    test('should not add character to occupied position', () => {
      level.addCharacter(character1, 5, 5);
      const result = level.addCharacter(character2, 5, 5);
      
      expect(result).toBe(false);
      expect(level.characters).toHaveLength(1);
      expect(level.characters).toContain(character1);
      expect(level.characters).not.toContain(character2);
    });

    test('should get character at specific position', () => {
      level.addCharacter(character1, 5, 5);
      
      const foundCharacter = level.getCharacterAt(5, 5);
      expect(foundCharacter).toBe(character1);
      
      const noCharacter = level.getCharacterAt(3, 3);
      expect(noCharacter).toBeNull();
    });

    test('should get all characters at specific position', () => {
      level.addCharacter(character1, 5, 5);
      
      const characters = level.getCharactersAt(5, 5);
      expect(characters).toHaveLength(1);
      expect(characters[0]).toBe(character1);
      
      const emptyCharacters = level.getCharactersAt(3, 3);
      expect(emptyCharacters).toHaveLength(0);
    });

    test('should move character to new position', () => {
      level.addCharacter(character1, 5, 5);
      
      const result = level.moveCharacter(character1, 7, 8);
      
      expect(result).toBe(true);
      expect(character1.x).toBe(7);
      expect(character1.y).toBe(8);
      expect(level.getCharacterAt(5, 5)).toBeNull();
      expect(level.getCharacterAt(7, 8)).toBe(character1);
    });

    test('should not move character to occupied position', () => {
      level.addCharacter(character1, 5, 5);
      level.addCharacter(character2, 7, 8);
      
      const result = level.moveCharacter(character1, 7, 8);
      
      expect(result).toBe(false);
      expect(character1.x).toBe(5);
      expect(character1.y).toBe(5);
    });

    test('should allow character to move to same position', () => {
      level.addCharacter(character1, 5, 5);
      
      const result = level.moveCharacter(character1, 5, 5);
      
      expect(result).toBe(true);
      expect(character1.x).toBe(5);
      expect(character1.y).toBe(5);
    });

    test('should remove character from level', () => {
      level.addCharacter(character1, 5, 5);
      level.addCharacter(character2, 7, 8);
      
      const result = level.removeCharacter(character1);
      
      expect(result).toBe(true);
      expect(level.characters).not.toContain(character1);
      expect(level.characters).toContain(character2);
      expect(level.getCharacterAt(5, 5)).toBeNull();
    });

    test('should return false when removing non-existent character', () => {
      const result = level.removeCharacter(character1);
      expect(result).toBe(false);
    });
  });

  describe('Collision Detection', () => {
    test('should check if position is passible without characters', () => {
      // Set up a passible tile
      level.map[5][5] = '.';
      
      expect(level.isPassible(5, 5)).toBe(true);
    });

    test('should check if position is impassible with character', () => {
      level.map[5][5] = '.';
      level.addCharacter(character1, 5, 5);
      
      expect(level.isPassible(5, 5)).toBe(false);
    });

    test('should check if position is impassible with wall', () => {
      level.map[5][5] = '#';
      
      expect(level.isPassible(5, 5)).toBe(false);
    });
  });

  describe('Player Character Integration', () => {
    test('should handle player character correctly', () => {
      const result = level.addCharacter(playerCharacter, 3, 4);
      
      expect(result).toBe(true);
      expect(playerCharacter.isPlayer).toBe(true);
      expect(level.getCharacterAt(3, 4)).toBe(playerCharacter);
    });

    test('should find player character by isPlayer flag', () => {
      level.addCharacter(character1, 1, 1);
      level.addCharacter(playerCharacter, 2, 2);
      level.addCharacter(character2, 3, 3);
      
      const player = level.characters.find(char => char.isPlayer);
      expect(player).toBe(playerCharacter);
    });
  });
});
