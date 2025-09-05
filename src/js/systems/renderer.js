import { CONFIG_SETTINGS } from '../utils/config.js';
import { RENDER_SYMBOLS } from '../utils/symbols.js';

// Helper function to find furniture at a specific position
function findFurnitureAt(worldX, worldY, gameState) {
  return gameState.currentLevel.furniture.find(
    furniture => furniture.x === worldX && furniture.y === worldY
  );
}

// Helper function to find item at a specific position
function findItemAt(worldX, worldY, gameState) {
  return gameState.currentLevel.items.find(
    item => item.x === worldX && item.y === worldY
  );
}

// Helper function to find character at a specific position
function findCharacterAt(worldX, worldY, gameState) {
  return gameState.currentLevel.getCharacterAt(worldX, worldY);
}

// Get the symbol to display for a specific tile
function getTileSymbol(worldX, worldY, gameState) {
  // Check if there's a character at this position (highest priority)
  const character = findCharacterAt(worldX, worldY, gameState);
  if (character) {
    return character.symbol;
  }
  
  // Check if there's furniture at this position
  const furniture = findFurnitureAt(worldX, worldY, gameState);
  if (furniture) {
    return furniture.getSymbol();
  }
  
  // Check if there's an item at this position
  const item = findItemAt(worldX, worldY, gameState);
  if (item) {
    // Get the item's symbol from the items data
    const itemData = gameState.itemsData[item.itemId];
    return itemData ? itemData.symbol : RENDER_SYMBOLS.ITEM;
  }
  
  // Return the world tile symbol
  return gameState.currentLevel.map[worldY][worldX];
}

// Game rendering function
export function render(gameState, gameDisplay, viewportWidth = CONFIG_SETTINGS.viewportWidth, viewportHeight = CONFIG_SETTINGS.viewportHeight) {
  const playerPos = gameState.getPlayerPosition();
  let displayText = '';

  // Calculate the top-left corner of the visible area
  const viewX = playerPos.x - Math.floor(viewportWidth / 2);
  const viewY = playerPos.y - Math.floor(viewportHeight / 2);

  // Render the visible area
  for (let y = 0; y < viewportHeight; y++) {
    for (let x = 0; x < viewportWidth; x++) {
      const worldX = viewX + x;
      const worldY = viewY + y;

      // Check if this position is within the world bounds
      if (
        worldX >= 0 &&
        worldX < gameState.currentLevel.width &&
        worldY >= 0 &&
        worldY < gameState.currentLevel.height
      ) {
        displayText += getTileSymbol(worldX, worldY, gameState);
      } else {
        displayText += RENDER_SYMBOLS.EMPTY; // Empty space outside world bounds
      }
    }
    displayText += '\n'; // Add newline at end of each row
  }

  // Update the display
  gameDisplay.textContent = displayText;
}
