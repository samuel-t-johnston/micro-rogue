import { LevelLoader } from '../systems/levelLoader.js';

// File-based world loading
export async function initializeWorld() {
  try {
    const levelLoader = new LevelLoader();
    const levelData = await levelLoader.loadLevel(
      '/data/levels/1-test-dungeon.json'
    );

    // Store the loaded level data for later use
    window.loadedLevelData = levelData;

    return levelData;
  } catch (error) {
    console.error('Failed to load level file:', error);
  }
}

// Place items from level data
export function placeItems(itemsData, dungeonLevel, levelData) {
  if (!levelData.items) {
    return;
  }

  for (const [coordKey, itemList] of levelData.items) {
    const [x, y] = coordKey.split(',').map(Number);

    // Skip if this position is occupied by the player
    if (dungeonLevel.getCharacterAt(x, y)) {
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

// Place furniture from level data
export function placeFurniture(furnitureData, dungeonLevel, itemsData, levelData) {
  if (!levelData.furniture) {
    return;
  }

  for (const furnitureInfo of levelData.furniture) {
    const { type, x, y } = furnitureInfo;

    // Skip if this position is occupied by the player
    if (dungeonLevel.getCharacterAt(x, y)) {
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
