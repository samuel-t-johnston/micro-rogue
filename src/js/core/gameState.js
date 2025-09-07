import { Character } from '../entities/character.js';
import { create } from '../utils/coordinates.js';
import { Furniture } from '../entities/furniture.js';

// Level-specific state
export class DungeonLevel {
  constructor(levelNumber, width, height, playerStartX = 5, playerStartY = 5) {
    this.levelNumber = levelNumber;
    this.width = width;
    this.height = height;
    this.map = []; // 2D array of tiles
    this.items = []; // Array of {x, y, itemId} objects
    this.furniture = []; // Array of Furniture instances
    this.characters = []; // Array of Character instances
    this.playerPosition = create(playerStartX, playerStartY); // Level-relative position (legacy, will be removed)
  }

  // Get item at specific position
  getItemAt(x, y) {
    return this.items.find(item => item.x === x && item.y === y);
  }

  // Get all items at specific position
  getItemsAt(x, y) {
    return this.items.filter(item => item.x === x && item.y === y);
  }

  // Get furniture at specific position
  getFurnitureAt(x, y) {
    return this.furniture.find(
      furniture => furniture.x === x && furniture.y === y
    );
  }

  // Get character at specific position
  getCharacterAt(x, y) {
    return this.characters.find(character => character.x === x && character.y === y) || null;
  }

  // Add character to level at specific position
  addCharacter(character, x, y) {
    // Check if position is already occupied
    if (this.getCharacterAt(x, y)) {
      return false; // Position occupied
    }
    
    // Set character position and add to array
    character.moveTo(x, y);
    this.characters.push(character);
    return true;
  }

  // Remove character from level
  removeCharacter(character) {
    const index = this.characters.indexOf(character);
    if (index === -1) {
      return false; // Character not found
    }
    
    this.characters.splice(index, 1);
    return true;
  }

  // Move character to new position
  moveCharacter(character, newX, newY) {
    // Check if new position is occupied by another character
    const existingCharacter = this.getCharacterAt(newX, newY);
    if (existingCharacter && existingCharacter !== character) {
      return false; // Position occupied by another character
    }
    
    // Update character position
    character.moveTo(newX, newY);
    return true;
  }

  // Get all characters at a specific position (for future multi-character support)
  getCharactersAt(x, y) {
    return this.characters.filter(character => character.x === x && character.y === y);
  }

  // Remove item from level
  removeItem(item) {
    const index = this.items.findIndex(
      i => i.x === item.x && i.y === item.y && i.itemId === item.itemId
    );
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  // Add item to level
  addItem(x, y, itemId) {
    this.items.push({ x, y, itemId });
  }

  // Add furniture to level
  addFurniture(x, y, furnitureId, furnitureData) {
    const furniture = new Furniture(x, y, furnitureId, furnitureData);
    this.furniture.push(furniture);
    return furniture;
  }

  // Remove furniture from level
  removeFurniture(furniture) {
    const index = this.furniture.findIndex(
      f =>
        f.x === furniture.x &&
        f.y === furniture.y &&
        f.furnitureId === furniture.furnitureId
    );
    if (index !== -1) {
      this.furniture.splice(index, 1);
      return true;
    }
    return false;
  }

  // Check if position is passible (considering furniture and characters)
  isPassible(x, y) {
    const tile = this.map[y][x];
    if (tile === '#' || tile === ' ') {
      return false; // Wall or solid rock
    }

    // Check if there's a character at this position
    if (this.getCharacterAt(x, y)) {
      return false; // Character present, not passible
    }

    const furniture = this.getFurnitureAt(x, y);
    if (!furniture) {
      return true; // No furniture, so passible
    } else {
      return furniture.isPassible(); // Furniture present, check if it's passible
    }
  }
}

// Persistent game state
export class GameState {
  constructor() {
    this.player = new Character(1, 1, 1, 1, 0, '@', 0, 0, true); // Direct reference to player character
    this.score = 0;
    this.turns = 0;
    this.messages = [];
    this.currentLevel = null; // DungeonLevel instance
    this.itemsData = {}; // Item definitions loaded from items.json
    this.furnitureData = {}; // Furniture definitions loaded from furniture.json
  }

  // Convenience methods
  getPlayerPosition() {
    if (!this.currentLevel) {
      return create(0, 0);
    }
    
    // Player character position is now stored directly in the character object
    return create(this.player.x, this.player.y);
  }

  setPlayerPosition(x, y) {
    if (this.currentLevel) {
      // Move player character to new position
      this.currentLevel.moveCharacter(this.player, x, y);
    }
  }

  // Initialize a new level
  initializeLevel(levelNumber, width, height, playerStartX = 5, playerStartY = 5) {
    this.currentLevel = new DungeonLevel(levelNumber, width, height, playerStartX, playerStartY);
    // Add player character to the level
    this.currentLevel.addCharacter(this.player, playerStartX, playerStartY);
  }

  // Reset game state for new game
  reset() {
    this.player = new Character(1, 1, 1, 1, 0, '@', 0, 0, true);
    this.score = 0;
    this.turns = 0;
    this.messages = [];
    this.initializeLevel(1, 11, 11); // Default room size
  }
}
