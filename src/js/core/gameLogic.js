import {
  initializeWorld,
  placeRandomItems,
  placeRandomFurniture,
} from './world.js';
import { render } from '../systems/renderer.js';
import { addMessage, updateUI } from '../ui/ui.js';
import { GameState, DungeonLevel } from './gameState.js';
import { addDelta, toString } from '../utils/coordinates.js';

// Load items from JSON file
export async function loadItems() {
  try {
    const response = await fetch('/data/items/items.json');
    const itemsData = await response.json();
    console.log('Items loaded:', itemsData);
    return itemsData;
  } catch (error) {
    console.error('Error loading items:', error);
    return {};
  }
}

// Load furniture from JSON file
export async function loadFurniture() {
  try {
    const response = await fetch('/data/furniture/furniture.json');
    const furnitureData = await response.json();
    console.log('Furniture loaded:', furnitureData);
    return furnitureData;
  } catch (error) {
    console.error('Error loading furniture:', error);
    return {};
  }
}

// Move player character
export function movePlayer(
  dx,
  dy,
  gameState,
  gameDisplay,
  choiceModeManager = null
) {
  const currentPos = gameState.getPlayerPosition();
  const newPos = addDelta(currentPos, dx, dy);

  // Check if position is passible considering furniture
  if (!gameState.currentLevel.isPassible(newPos.x, newPos.y)) {
    const furniture = gameState.currentLevel.getFurnitureAt(newPos.x, newPos.y);
    if (furniture) {
      addMessage(
        `You can't move through the ${furniture.getName()}!`,
        gameState,
        gameState.player
      );
    } else {
      addMessage("You can't move there!", gameState, gameState.player);
    }
    return { newPlayerX: currentPos.x, newPlayerY: currentPos.y };
  }

  gameState.setPlayerPosition(newPos.x, newPos.y);
  gameState.turns++;
  addMessage(`Moved to ${toString(newPos)}`, gameState, gameState.player);

  // Check if there's an item at the new position
  const itemAtPosition = gameState.currentLevel.getItemAt(newPos.x, newPos.y);
  if (itemAtPosition) {
    const itemName =
      gameState.itemsData[itemAtPosition.itemId]?.name || 'Unknown Item';
    addMessage(`You see a ${itemName} here.`, gameState, gameState.player);
  }

  // Check if there's furniture at the new position
  const furnitureAtPosition = gameState.currentLevel.getFurnitureAt(
    newPos.x,
    newPos.y
  );
  if (furnitureAtPosition) {
    let message = `You see a ${furnitureAtPosition.getStateDescription()}.`;

    // Add container information if it's an open container
    if (
      furnitureAtPosition.isContainer() &&
      furnitureAtPosition.state === 'open'
    ) {
      const containerItems = furnitureAtPosition.getContainerItems();
      if (containerItems.length > 0) {
        const itemNames = containerItems.map(item => item.name).join(', ');
        message += ` It contains: ${itemNames}`;
      } else {
        message += ' It is empty.';
      }
    }

    addMessage(message, gameState, gameState.player);
  }

  render(gameState, gameDisplay);
  updateUI(gameState, gameState.player, choiceModeManager);
  return { newPlayerX: newPos.x, newPlayerY: newPos.y };
}

// Initialize game
export async function initGame() {
  const gameState = new GameState();
  gameState.reset();

  // Load items, furniture and initialize world
  gameState.itemsData = await loadItems();
  gameState.furnitureData = await loadFurniture();
  const levelData = await initializeWorld();
  
  // Create new level with proper dimensions and player start position
  gameState.currentLevel = new DungeonLevel(
    1, 
    levelData.width, 
    levelData.height, 
    levelData.playerStart[0], 
    levelData.playerStart[1]
  );
  
  // Set the map data
  gameState.currentLevel.map = levelData.map;
  
  placeRandomItems(gameState.itemsData, gameState.currentLevel);
  placeRandomFurniture(
    gameState.furnitureData,
    gameState.currentLevel,
    gameState.itemsData
  );

  addMessage('Welcome to ROGµE!', gameState, gameState.player);
  addMessage('Use WASD or arrow keys to move.', gameState, gameState.player);
  addMessage(
    `Your character has ${gameState.player.maxHp} max HP.`,
    gameState,
    gameState.player
  );
  addMessage(
    'You are in a simple room. Explore with WASD!',
    gameState,
    gameState.player
  );
  addMessage(
    'You see some items ($) and furniture scattered around the room.',
    gameState,
    gameState.player
  );

  return gameState;
}

// Pick up item at player's current position
export function pickUpItem(gameState, gameDisplay, choiceModeManager = null) {
  // Check if inventory is full first
  if (!gameState.player.canAddToInventory()) {
    addMessage(
      "Can't pick anything else up. Inventory is full.",
      gameState,
      gameState.player
    );
    return;
  }

  const playerPos = gameState.getPlayerPosition();
  const itemAtPosition = gameState.currentLevel.getItemAt(
    playerPos.x,
    playerPos.y
  );

  if (itemAtPosition) {
    const itemName =
      gameState.itemsData[itemAtPosition.itemId]?.name || 'Unknown Item';

    // Create inventory item with name
    const inventoryItem = {
      ...itemAtPosition,
      name: itemName,
    };

    // Try to add item to player's inventory
    const addedItem = gameState.player.addToInventory(inventoryItem);

    if (addedItem) {
      // Remove item from level
      gameState.currentLevel.removeItem(itemAtPosition);

      addMessage(`Picked up ${itemName}!`, gameState, gameState.player);
      render(gameState, gameDisplay);
      updateUI(gameState, gameState.player, choiceModeManager);
    } else {
      addMessage('Your inventory is full!', gameState, gameState.player);
    }
  } else {
    // Check if there's an open container with items at the player's position
    const furnitureAtPosition = gameState.currentLevel.getFurnitureAt(
      playerPos.x,
      playerPos.y
    );

    if (
      furnitureAtPosition &&
      furnitureAtPosition.isContainer() &&
      furnitureAtPosition.state === 'open'
    ) {
      const containerItems = furnitureAtPosition.getContainerItems();

      if (containerItems.length > 0) {
        // Take the first item from the container
        const item = furnitureAtPosition.removeItemFromContainer(0);

        if (item) {
          // Create inventory item with name
          const inventoryItem = {
            ...item,
            name: item.name || 'Unknown Item',
          };

          // Try to add item to player's inventory
          const addedItem = gameState.player.addToInventory(inventoryItem);

          if (addedItem) {
            addMessage(
              `Took ${item.name} from the ${furnitureAtPosition.getName()}.`,
              gameState,
              gameState.player
            );
            render(gameState, gameDisplay);
            updateUI(gameState, gameState.player, choiceModeManager);
          } else {
            // Put the item back if inventory is full
            furnitureAtPosition.addItemToContainer(item);
            addMessage('Your inventory is full!', gameState, gameState.player);
          }
        }
      } else {
        addMessage(
          `The ${furnitureAtPosition.getName()} is empty.`,
          gameState,
          gameState.player
        );
      }
    } else {
      addMessage("There's nothing to pick up.", gameState, gameState.player);
    }
  }
}

// Get all available items at player's current position (ground + open containers)
export function getAvailableItems(gameState) {
  const playerPos = gameState.getPlayerPosition();
  const availableItems = [];

  // Check for items on the ground
  const itemAtPosition = gameState.currentLevel.getItemAt(
    playerPos.x,
    playerPos.y
  );
  if (itemAtPosition) {
    const itemName =
      gameState.itemsData[itemAtPosition.itemId]?.name || 'Unknown Item';
    availableItems.push({
      ...itemAtPosition,
      name: itemName,
      source: 'ground',
    });
  }

  // Check for items in open containers
  const furnitureAtPosition = gameState.currentLevel.getFurnitureAt(
    playerPos.x,
    playerPos.y
  );
  if (
    furnitureAtPosition &&
    furnitureAtPosition.isContainer() &&
    furnitureAtPosition.state === 'open'
  ) {
    const containerItems = furnitureAtPosition.getContainerItems();
    containerItems.forEach((item, index) => {
      availableItems.push({
        ...item,
        name: item.name || 'Unknown Item',
        source: 'container',
        containerName: furnitureAtPosition.getName(),
        containerIndex: index,
      });
    });
  }

  return availableItems;
}

// Pick up a specific item by index from the available items list
export function pickUpItemByIndex(
  index,
  gameState,
  gameDisplay,
  choiceModeManager = null
) {
  const availableItems = getAvailableItems(gameState);

  if (index < 0 || index >= availableItems.length) {
    addMessage('Invalid item selection.', gameState, gameState.player);
    return false;
  }

  const selectedItem = availableItems[index];

  // Check if inventory is full
  if (!gameState.player.canAddToInventory()) {
    addMessage(
      "Can't pick anything else up. Inventory is full.",
      gameState,
      gameState.player
    );
    return false;
  }

  // Create inventory item with name
  const inventoryItem = {
    ...selectedItem,
    name: selectedItem.name || 'Unknown Item',
  };

  // Try to add item to player's inventory
  const addedItem = gameState.player.addToInventory(inventoryItem);

  if (addedItem) {
    // Remove item from its source
    if (selectedItem.source === 'ground') {
      gameState.currentLevel.removeItem(selectedItem);
      addMessage(
        `Picked up ${selectedItem.name}!`,
        gameState,
        gameState.player
      );
    } else if (selectedItem.source === 'container') {
      const furnitureAtPosition = gameState.currentLevel.getFurnitureAt(
        gameState.getPlayerPosition().x,
        gameState.getPlayerPosition().y
      );
      if (furnitureAtPosition) {
        furnitureAtPosition.removeItemFromContainer(
          selectedItem.containerIndex
        );
        addMessage(
          `Took ${selectedItem.name} from the ${selectedItem.containerName}.`,
          gameState,
          gameState.player
        );
      }
    }

    render(gameState, gameDisplay);
    updateUI(gameState, gameState.player, choiceModeManager);
    return true;
  } else {
    addMessage('Your inventory is full!', gameState, gameState.player);
    return false;
  }
}

// Use furniture at a relative position from the player
export function useFurniture(
  dx,
  dy,
  gameState,
  gameDisplay,
  onUIUpdate = null
) {
  const playerPos = gameState.getPlayerPosition();
  const targetX = playerPos.x + dx;
  const targetY = playerPos.y + dy;

  // Check if there's furniture at the target position
  const furniture = gameState.currentLevel.getFurnitureAt(targetX, targetY);
  if (!furniture) {
    addMessage("There's nothing to use there.", gameState, gameState.player);
    if (onUIUpdate) onUIUpdate();
    return false;
  }

  // Check if the furniture is usable
  if (!furniture.isUsable()) {
    addMessage(
      `You can't use the ${furniture.getName()}.`,
      gameState,
      gameState.player
    );
    if (onUIUpdate) onUIUpdate();
    return false;
  }

  // Handle different usable actions
  const furnitureDef = gameState.furnitureData[furniture.furnitureId];
  if (furnitureDef.usable.action === 'toggle_state') {
    if (furniture.toggleState()) {
      const newState = furniture.state;
      let message = `You ${newState === 'open' ? 'opened' : 'closed'} the ${furniture.getName()}.`;

      // Add container information if it's a container
      if (furniture.isContainer()) {
        const containerStatus = furniture.getContainerStatus();
        if (containerStatus) {
          message += ` ${containerStatus}`;
        }

        // If opening a container with items, show what's inside
        if (newState === 'open' && furniture.getContainerItems().length > 0) {
          const items = furniture.getContainerItems();
          const itemNames = items.map(item => item.name).join(', ');
          message += ` You see: ${itemNames}`;
        } else if (
          newState === 'open' &&
          furniture.getContainerItems().length === 0
        ) {
          message += ' It is empty.';
        }
      }

      addMessage(message, gameState, gameState.player);

      // Update the game display
      render(gameState, gameDisplay);
      if (onUIUpdate) onUIUpdate();
      return true;
    } else {
      addMessage(
        `You can't toggle the ${furniture.getName()}.`,
        gameState,
        gameState.player
      );
      if (onUIUpdate) onUIUpdate();
      return false;
    }
  }

  addMessage(
    `You don't know how to use the ${furniture.getName()}.`,
    gameState,
    gameState.player
  );
  if (onUIUpdate) onUIUpdate();
  return false;
}
