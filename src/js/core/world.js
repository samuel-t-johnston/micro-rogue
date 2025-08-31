import { GAME_CONFIG } from '../utils/config.js';
import { create, equals } from '../utils/coordinates.js';
import { LevelLoader } from '../systems/levelLoader.js';

// Async version for v2 loading
export async function initializeWorldAsync() {
  return await initializeWorldV2();
}

// Version 2: File-based world loading
async function initializeWorldV2() {
  try {
    const levelLoader = new LevelLoader();
    const levelData = await levelLoader.loadLevel(
      './src/data/levels/1-test-dungeon.json'
    );

    // Update GAME_CONFIG to match the loaded level dimensions
    GAME_CONFIG.width = levelData.width;
    GAME_CONFIG.height = levelData.height;
    GAME_CONFIG.roomSize = Math.max(levelData.width, levelData.height);

    // Update player starting position from level data
    GAME_CONFIG.playerStartX = levelData.playerStart[0];
    GAME_CONFIG.playerStartY = levelData.playerStart[1];

    // Store the loaded level data for later use
    window.loadedLevelData = levelData;

    return levelData.map;
  } catch (error) {
    console.error('Failed to load level file:', error);
  }
}

// TEMPORARY: This function will be replaced with proper item placement logic later
export function placeRandomItems(itemsData, dungeonLevel) {
  // Check if we have loaded level data (v2 world generation)
  if (window.loadedLevelData && window.loadedLevelData.items) {
    placeLoadedItems(itemsData, dungeonLevel, window.loadedLevelData);
    return;
  }
}

// Place items from loaded level data
function placeLoadedItems(itemsData, dungeonLevel, levelData) {
  for (const [coordKey, itemList] of levelData.items) {
    const [x, y] = coordKey.split(',').map(Number);

    // Skip if this position is occupied by the player
    if (equals(create(x, y), dungeonLevel.playerPosition)) {
      continue;
    }

    for (const itemId of itemList) {
      if (itemId === '?') {
        // Random item
        const itemIds = Object.keys(itemsData);
        if (itemIds.length > 0) {
          const randomItemId =
            itemIds[Math.floor(Math.random() * itemIds.length)];
          dungeonLevel.addItem(x, y, randomItemId);
        }
      } else {
        // Specific item
        dungeonLevel.addItem(x, y, itemId);
      }
    }
  }
}

// Place random furniture in the dungeon level
export function placeRandomFurniture(furnitureData, dungeonLevel, itemsData) {
  // Check if we have loaded level data (v2 world generation)
  if (window.loadedLevelData && window.loadedLevelData.furniture) {
    placeLoadedFurniture(
      furnitureData,
      dungeonLevel,
      itemsData,
      window.loadedLevelData
    );
    return;
  }
}

// Place furniture from loaded level data
function placeLoadedFurniture(
  furnitureData,
  dungeonLevel,
  itemsData,
  levelData
) {
  for (const furnitureInfo of levelData.furniture) {
    const { type, x, y } = furnitureInfo;

    // Skip if this position is occupied by the player
    if (equals(create(x, y), dungeonLevel.playerPosition)) {
      continue;
    }

    // Get furniture definition
    const furnitureDef = furnitureData[type];
    if (!furnitureDef) {
      console.warn(`Unknown furniture type: ${type}`);
      continue;
    }

    // Create and place furniture
    const furniture = dungeonLevel.addFurniture(x, y, type, furnitureDef);

    // Populate containers with random items
    if (furniture && furniture.isContainer()) {
      populateContainerWithItems(furniture, itemsData, 3);
    }
  }
}

// Populate a container with random items
function populateContainerWithItems(furniture, itemsData, numItems = 1) {
  // Safety check: ensure itemsData exists and has items
  if (!itemsData || typeof itemsData !== 'object') {
    return;
  }

  const itemIds = Object.keys(itemsData);
  if (itemIds.length === 0) {
    return;
  }

  const containerDef = furniture.data.container;
  const maxItems = containerDef.capacity;

  // Add exactly 1 random item to the container for easier testing
  const numItemsToAdd = Math.min(numItems, maxItems);

  for (let i = 0; i < numItemsToAdd; i++) {
    const randomItemId = itemIds[Math.floor(Math.random() * itemIds.length)];
    const itemData = itemsData[randomItemId];

    // Create item object with name
    const item = {
      itemId: randomItemId,
      name: itemData.name || 'Unknown Item',
    };

    furniture.addItemToContainer(item);
  }
}
