// Level loading and parsing functions
export class LevelLoader {
  constructor() {
    this.supportedTypes = ['fixed_layout'];
  }

  // Load a level from a JSON file
  async loadLevel(levelPath) {
    try {
      const response = await fetch(levelPath);
      if (!response.ok) {
        throw new Error(`Failed to load level: ${response.status} ${response.statusText}`);
      }
      
      const levelData = await response.json();
      return this.parseLevel(levelData);
    } catch (error) {
      console.error('Error loading level:', error);
      throw error;
    }
  }

  // Parse level data and create a DungeonLevel object
  parseLevel(levelData) {
    // Validate level structure
    this.validateLevelStructure(levelData);
    
    // Extract level information
    const { name, type, level_data } = levelData;
    
    if (!this.supportedTypes.includes(type)) {
      throw new Error(`Unsupported level type: ${type}`);
    }

    // Parse the grid into a 2D array
    const map = this.parseGrid(level_data.grid, level_data.width, level_data.height);
    
    // Parse items
    const items = this.parseItems(level_data.items);
    
    // Parse furniture (from grid symbols)
    const furniture = this.parseFurniture(level_data.grid, level_data.width, level_data.height);
    
    return {
      name,
      type,
      width: level_data.width,
      height: level_data.height,
      playerStart: level_data.player_start,
      map,
      items,
      furniture
    };
  }

  // Parse the grid array into a 2D map array
  parseGrid(gridArray, width, height) {
    if (gridArray.length !== height) {
      throw new Error(`Grid height mismatch: expected ${height}, got ${gridArray.length}`);
    }

    const map = [];
    for (let y = 0; y < height; y++) {
      const row = gridArray[y];
      if (row.length !== width) {
        throw new Error(`Grid row ${y} width mismatch: expected ${width}, got ${row.length}`);
      }
      
      map[y] = [];
      for (let x = 0; x < width; x++) {
        map[y][x] = row[x];
      }
    }
    
    return map;
  }

  // Parse items array into a map of coordinates to item lists
  parseItems(itemsArray) {
    const items = new Map();
    
    for (const itemData of itemsArray) {
      const [x, y] = itemData.location;
      const coordKey = `${x},${y}`;
      items.set(coordKey, itemData.items);
    }
    
    return items;
  }

  // Parse furniture from grid symbols
  //TODO: Convert to use the Furniture class - import { Furniture } from './furniture.js';
  parseFurniture(gridArray, width, height) {
    const furniture = [];
    
    // Scan the grid for furniture symbols
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const symbol = gridArray[y][x];
        
        // Check if this symbol corresponds to furniture
        if (symbol === 'O') { // Boulder
          furniture.push({
            type: 'boulder',
            x, y,
            symbol: 'O'
          });
        } else if (symbol === '+') { // Door
          furniture.push({
            type: 'door',
            x, y,
            symbol: '+'
          });
        } else if (symbol === '=') { // Heavy Chest
          furniture.push({
            type: 'heavy_chest',
            x, y,
            symbol: '='
          });
        }
      }
    }
    
    return furniture;
  }

  // Validate the basic structure of the level data
  validateLevelStructure(levelData) {
    if (!levelData.name || !levelData.type || !levelData.level_data) {
      throw new Error('Invalid level structure: missing required fields');
    }
    
    const { level_data } = levelData;
    if (!level_data.width || !level_data.height || !level_data.grid || !level_data.player_start) {
      throw new Error('Invalid level_data: missing required fields');
    }
    
    if (!Array.isArray(level_data.grid)) {
      throw new Error('Grid must be an array');
    }
    
    if (!Array.isArray(level_data.player_start) || level_data.player_start.length !== 2) {
      throw new Error('player_start must be an array of [x, y] coordinates');
    }
  }
}
