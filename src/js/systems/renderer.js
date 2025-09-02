import { CONFIG_SETTINGS } from '../utils/config.js';
import { equals } from '../utils/coordinates.js';

// Game rendering function
export function render(gameState, gameDisplay, viewportWidth = CONFIG_SETTINGS.viewportWidth, viewportHeight = CONFIG_SETTINGS.viewportHeight) {
  const playerPos = gameState.getPlayerPosition();
  const worldMap = gameState.currentLevel.map;
  const worldItems = gameState.currentLevel.items;
  const worldFurniture = gameState.currentLevel.furniture;

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
        // Check if this is the player position
        if (equals({ x: worldX, y: worldY }, playerPos)) {
          displayText += '@'; // Player character
        } else {
          // Check if there's furniture at this position
          const furnitureAtPosition = worldFurniture.find(
            furniture => furniture.x === worldX && furniture.y === worldY
          );
          if (furnitureAtPosition) {
            displayText += furnitureAtPosition.getSymbol(); // Furniture symbol
          } else {
            // Check if there's an item at this position
            const itemAtPosition = worldItems.find(
              item => item.x === worldX && item.y === worldY
            );
            if (itemAtPosition) {
              displayText += '$'; // Item symbol
            } else {
              displayText += worldMap[worldY][worldX]; // World tile
            }
          }
        }
      } else {
        displayText += ' '; // Empty space outside world bounds
      }
    }
    displayText += '\n'; // Add newline at end of each row
  }

  // Update the display
  gameDisplay.textContent = displayText;
}
