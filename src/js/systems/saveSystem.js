import { CONFIG_SETTINGS } from '../utils/config.js';
import { Character } from '../entities/character.js';
import { Furniture } from '../entities/furniture.js';
import { DungeonLevel, GameState } from '../core/gameState.js';
import { create } from '../utils/coordinates.js';

// Save system for persisting game state to localStorage
export class SaveSystem {
  constructor() {
    this.saveKey = 'rogue-save';
    this.saveVersion = CONFIG_SETTINGS.saveFileCompatibilityVersion;
  }

  // Save game state to localStorage
  saveGame(gameState) {
    try {
      const saveData = this.serializeGameState(gameState);
      localStorage.setItem(this.saveKey, JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  // Load game state from localStorage
  loadGame() {
    try {
      const saveData = localStorage.getItem(this.saveKey);
      if (!saveData) {
        return null; // No save data found
      }

      const parsedData = JSON.parse(saveData);
      return this.deserializeGameState(parsedData);
    } catch (error) {
      console.error('Failed to load game:', error);
      return null;
    }
  }

  // Check if save data exists
  hasSaveData() {
    return localStorage.getItem(this.saveKey) !== null;
  }

  // Delete save data
  deleteSave() {
    localStorage.removeItem(this.saveKey);
  }

  // Serialize game state to JSON-serializable format
  serializeGameState(gameState) {
    return {
      version: this.saveVersion,
      gameState: {
        score: gameState.score,
        turns: gameState.turns,
        messages: gameState.messages,
        player: this.serializeCharacter(gameState.player)
      },
      currentLevel: this.serializeDungeonLevel(gameState.currentLevel),
      metadata: {
        saveDate: new Date().toISOString(),
        gameVersion: CONFIG_SETTINGS.gameVersion
      }
    };
  }

  // Deserialize game state from JSON
  deserializeGameState(saveData) {
    // Validate version compatibility
    if (saveData.version !== this.saveVersion) {
      console.warn(`Save file version ${saveData.version} may not be compatible with current version ${this.saveVersion}`);
    }

    // Create a proper GameState instance
    const gameState = new GameState();
    gameState.score = saveData.gameState.score;
    gameState.turns = saveData.gameState.turns;
    gameState.messages = saveData.gameState.messages;
    
    // Deserialize the level first
    gameState.currentLevel = this.deserializeDungeonLevel(saveData.currentLevel);
    
    // Find the player character in the level's characters array
    // (it should be the one with isPlayer = true)
    gameState.player = gameState.currentLevel.characters.find(char => char.isPlayer);
    
    // If no player character found, create one as fallback
    if (!gameState.player) {
      gameState.player = this.deserializeCharacter(saveData.gameState.player);
      // Add it to the level
      gameState.currentLevel.addCharacter(gameState.player, gameState.player.x, gameState.player.y);
    }
    
    gameState.itemsData = {}; // Will be loaded separately
    gameState.furnitureData = {}; // Will be loaded separately

    return gameState;
  }

  // Serialize Character object
  serializeCharacter(character) {
    return {
      body: character.body,
      mind: character.mind,
      agility: character.agility,
      control: character.control,
      hpBonus: character.hpBonus,
      symbol: character.symbol,
      x: character.x,
      y: character.y,
      isPlayer: character.isPlayer,
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      inventory: character.inventory,
      maxInventorySize: character.maxInventorySize,
      equipment: character.equipment
    };
  }

  // Deserialize Character object
  deserializeCharacter(characterData) {
    const character = new Character(
      characterData.body,
      characterData.mind,
      characterData.agility,
      characterData.control,
      characterData.hpBonus,
      characterData.symbol,
      characterData.x || 0,
      characterData.y || 0,
      characterData.isPlayer || false
    );
    
    character.currentHp = characterData.currentHp;
    character.maxHp = characterData.maxHp;
    character.inventory = characterData.inventory || [];
    character.maxInventorySize = characterData.maxInventorySize || 5;
    character.equipment = characterData.equipment || {
      weapon1: null,
      weapon2: null,
      head: null,
      body: null,
      hands: null,
      legs: null,
      feet: null,
      neck: null,
      rings: new Array(10).fill(null)
    };
    
    return character;
  }

  // Serialize DungeonLevel object
  serializeDungeonLevel(level) {
    if (!level) return null;

    return {
      levelNumber: level.levelNumber,
      width: level.width,
      height: level.height,
      map: level.map,
      items: level.items,
      furniture: level.furniture.map(f => this.serializeFurniture(f)),
      characters: level.characters.map(c => this.serializeCharacter(c)),
      playerPosition: level.playerPosition
    };
  }

  // Deserialize DungeonLevel object
  deserializeDungeonLevel(levelData) {
    if (!levelData) return null;

    const level = new DungeonLevel(
      levelData.levelNumber,
      levelData.width,
      levelData.height
    );

    level.map = levelData.map;
    level.items = levelData.items || [];
    level.furniture = levelData.furniture.map(f => this.deserializeFurniture(f));
    level.characters = levelData.characters.map(c => this.deserializeCharacter(c));
    
    level.playerPosition = levelData.playerPosition ? 
      create(levelData.playerPosition.x, levelData.playerPosition.y) : 
      create(0, 0);

    return level;
  }

  // Serialize Furniture object
  serializeFurniture(furniture) {
    return {
      x: furniture.x,
      y: furniture.y,
      furnitureId: furniture.furnitureId,
      state: furniture.state,
      containerItems: furniture.containerItems,
      data: furniture.data
    };
  }

  // Deserialize Furniture object
  deserializeFurniture(furnitureData) {
    const furniture = new Furniture(
      furnitureData.x,
      furnitureData.y,
      furnitureData.furnitureId,
      furnitureData.data
    );
    
    furniture.state = furnitureData.state;
    furniture.containerItems = furnitureData.containerItems;
    
    return furniture;
  }
}

// Create singleton instance
export const saveSystem = new SaveSystem();
