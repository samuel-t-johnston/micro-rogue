import { Character } from '../entities/character.js';
import { create } from '../utils/coordinates.js';
import { GAME_CONFIG } from '../utils/config.js';
import { Furniture } from '../entities/furniture.js';

// Level-specific state
export class DungeonLevel {
  constructor(levelNumber, width, height) {
    this.levelNumber = levelNumber;
    this.width = width;
    this.height = height;
    this.map = []; // 2D array of tiles
    this.items = []; // Array of {x, y, itemId} objects
    this.furniture = []; // Array of Furniture instances
    this.playerPosition = create(
      GAME_CONFIG.playerStartX,
      GAME_CONFIG.playerStartY
    ); // Level-relative position
  }

  // Get item at specific position
  getItemAt(x, y) {
    return this.items.find(item => item.x === x && item.y === y);
  }

  // Get furniture at specific position
  getFurnitureAt(x, y) {
    return this.furniture.find(
      furniture => furniture.x === x && furniture.y === y
    );
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

  // Check if position is passible (considering furniture)
  isPassible(x, y) {
    const tile = this.map[y][x];
    if (tile === '#' || tile === ' ') {
      return false; // Wall or solid rock
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
    this.player = new Character(1, 1, 1, 1, 0);
    this.score = 0;
    this.turns = 0;
    this.messages = [];
    this.currentLevel = null; // DungeonLevel instance
    this.itemsData = {}; // Item definitions loaded from items.json
    this.furnitureData = {}; // Furniture definitions loaded from furniture.json
  }

  // Convenience methods
  getPlayerPosition() {
    return this.currentLevel?.playerPosition || create(0, 0);
  }

  setPlayerPosition(x, y) {
    if (this.currentLevel) {
      this.currentLevel.playerPosition = create(x, y);
    }
  }

  // Initialize a new level
  initializeLevel(levelNumber, width, height) {
    this.currentLevel = new DungeonLevel(levelNumber, width, height);
  }

  // Reset game state for new game
  reset() {
    this.player = new Character(1, 1, 1, 1, 0);
    this.score = 0;
    this.turns = 0;
    this.messages = [];
    this.initializeLevel(1, 11, 11); // Default room size
  }
}
