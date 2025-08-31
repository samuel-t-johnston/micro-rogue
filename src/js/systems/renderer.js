import { GAME_CONFIG } from '../utils/config.js';
import { equals } from '../utils/coordinates.js';

// Game rendering function
export function render(gameState, gameDisplay) {
  const playerPos = gameState.getPlayerPosition();
  const worldMap = gameState.currentLevel.map;
  const worldItems = gameState.currentLevel.items;
  const worldFurniture = gameState.currentLevel.furniture;

  let displayText = '';

  // Calculate the top-left corner of the visible area
  const viewX = playerPos.x - Math.floor(GAME_CONFIG.width / 2);
  const viewY = playerPos.y - Math.floor(GAME_CONFIG.height / 2);

  // Render the visible area
  for (let y = 0; y < GAME_CONFIG.height; y++) {
    for (let x = 0; x < GAME_CONFIG.width; x++) {
      const worldX = viewX + x;
      const worldY = viewY + y;

      // Check if this position is within the world bounds
      if (
        worldX >= 0 &&
        worldX < GAME_CONFIG.width &&
        worldY >= 0 &&
        worldY < GAME_CONFIG.height
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
