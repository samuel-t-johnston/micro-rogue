import {
  initializeWorld,
  placeItems,
  placeFurniture,
} from './world.js';
import { render } from '../systems/renderer.js';
import { addMessage, updateUI } from '../ui/ui.js';
import { GameState } from './gameState.js';
import { addDelta, toString } from '../utils/coordinates.js';
import { saveSystem } from '../systems/saveSystem.js';
import { CONFIG_SETTINGS } from '../utils/config.js';
import { DataFileLoader } from '../systems/dataFileLoader.js';
import { EffectManager } from '../systems/effectManager.js';

// Create a shared DataFileLoader instance
const dataLoader = new DataFileLoader();

// Load items from JSON file
export async function loadItems() {
  return await dataLoader.loadItems();
}

// Load furniture from JSON file
export async function loadFurniture() {
  return await dataLoader.loadFurniture();
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

  // Check for auto-save
  checkAutoSave(gameState);

  // Check if there are items at the new position
  const itemsAtPosition = gameState.currentLevel.getItemsAt(newPos.x, newPos.y);
  if (itemsAtPosition.length > 0) {
    const itemNames = itemsAtPosition.map(item => 
      gameState.itemsData[item.itemId]?.name || 'Unknown Item'
    );
    
    if (itemNames.length === 1) {
      addMessage(`You see a ${itemNames[0]} here.`, gameState, gameState.player);
    } else {
      addMessage(`You see: ${itemNames.join(', ')}`, gameState, gameState.player);
    }
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
  gameState.initializeLevel(
    1, 
    levelData.width, 
    levelData.height, 
    levelData.playerStart[0], 
    levelData.playerStart[1]
  );
  
  // Set the map data
  gameState.currentLevel.map = levelData.map;
  
  placeItems(gameState.itemsData, gameState.currentLevel, levelData);
  placeFurniture(
    gameState.furnitureData,
    gameState.currentLevel,
    gameState.itemsData,
    levelData
  );

  addMessage('Welcome to ROGµE!', gameState, gameState.player);
  addMessage('Use WASD or arrow keys to move.', gameState, gameState.player);

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
  const itemsAtPosition = gameState.currentLevel.getItemsAt(
    playerPos.x,
    playerPos.y
  );
  itemsAtPosition.forEach(item => {
    const itemName =
      gameState.itemsData[item.itemId]?.name || 'Unknown Item';
    availableItems.push({
      ...item,
      name: itemName,
      source: 'ground',
    });
  });

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

// Save game state to localStorage
export function saveGame(gameState) {
  const success = saveSystem.saveGame(gameState);
  if (success) {
    addMessage('Game saved!', gameState, gameState.player);
  } else {
    addMessage('Failed to save game!', gameState, gameState.player);
  }
  return success;
}

// Load game state from localStorage
export function loadGame() {
  const loadedState = saveSystem.loadGame();
  if (loadedState) {
    // Load items and furniture data
    return loadedState;
  }
  return null;
}

// Check if save data exists
export function hasSaveData() {
  return saveSystem.hasSaveData();
}

// Delete save data
export function deleteSave() {
  saveSystem.deleteSave();
}

// Auto-save check (call this after each turn)
export function checkAutoSave(gameState) {
  if (gameState.turns > 0 && gameState.turns % CONFIG_SETTINGS.saveFrequency === 0) {
    saveSystem.saveGame(gameState);
    addMessage('Game auto-saved!', gameState, gameState.player);
  }
}

// Get all equipment items from player's inventory
export function getAvailableEquipment(gameState) {
  return gameState.player.inventory.filter(item => {
    const itemData = gameState.itemsData[item.itemId];
    return itemData && itemData.equipment && itemData.equipment.slot !== 'rings';
  });
}

// Get all items in player inventory
export function getInventoryItems(gameState) {
  return gameState.player.inventory;
}

// Get all equipped items from player
export function getEquippedItems(gameState) {
  return gameState.player.getEquippedItems();
}

// Get all consumable items from player's inventory
export function getConsumableItems(gameState) {
  return gameState.player.inventory.filter(item => {
    const itemData = gameState.itemsData[item.itemId];
    return itemData && itemData.consumable;
  });
}

// Consume an item by index from available consumable items
export function consumeItemByIndex(itemIndex, gameState, gameDisplay, choiceModeManager) {
  const consumableItems = getConsumableItems(gameState);
  
  if (itemIndex < 0 || itemIndex >= consumableItems.length) {
    addMessage('Invalid consumable selection.', gameState, gameState.player);
    return false;
  }
  
  const selectedItem = consumableItems[itemIndex];
  const itemData = gameState.itemsData[selectedItem.itemId];
  const consumeEffect = itemData.consumable.consume_effect;
  
  // Parse and apply the consume effect
  if (consumeEffect) {
    // Simple parsing for immediate effects (e.g., "currentHp+5")
    const match = consumeEffect.match(/^currentHp\+(\d+)$/);
    if (match) {
      const healAmount = parseInt(match[1]);
      gameState.player.heal(healAmount);
      addMessage(`Consumed ${selectedItem.name} and healed ${healAmount} HP!`, gameState, gameState.player);
    } else {
      addMessage(`Unknown consume effect: ${consumeEffect}`, gameState, gameState.player);
      return false;
    }
  }
  
  // Remove item from inventory
  const inventoryIndex = gameState.player.inventory.findIndex(invItem => invItem === selectedItem);
  if (inventoryIndex !== -1) {
    gameState.player.removeFromInventory(inventoryIndex);
  }
  
  render(gameState, gameDisplay);
  updateUI(gameState, gameState.player, choiceModeManager);
  return true;
}

// Handle weapon equipping with special logic for two weapon slots
function handleWeaponEquipping(selectedItem, gameState, gameDisplay, choiceModeManager) {
  const weapon1 = gameState.player.equipment.weapon1;
  const weapon2 = gameState.player.equipment.weapon2;
  
  // Check if there's an empty weapon slot
  if (!weapon1) {
    // First weapon slot is empty - equip there
    return equipItemDirectly(selectedItem, 'weapon1', gameState, gameDisplay, choiceModeManager);
  } else if (!weapon2) {
    // Second weapon slot is empty - equip there
    return equipItemDirectly(selectedItem, 'weapon2', gameState, gameDisplay, choiceModeManager);
  } else {
    // Both weapon slots are occupied - ask which one to replace
    const equippedWeapons = [
      { item: weapon1, slot: 'weapon1' },
      { item: weapon2, slot: 'weapon2' }
    ];
    
    choiceModeManager.setMode('numeric', {
      action: 'weapon_replace',
      newItem: selectedItem,
      weapons: equippedWeapons
    });
    return false; // Don't complete the action yet
  }
}

// Equip an item by index from available equipment
export function equipItemByIndex(itemIndex, gameState, gameDisplay, choiceModeManager) {
  const availableEquipment = getAvailableEquipment(gameState);
  
  if (itemIndex < 0 || itemIndex >= availableEquipment.length) {
    addMessage('Invalid equipment selection.', gameState, gameState.player);
    return false;
  }

  const selectedItem = availableEquipment[itemIndex];
  const itemData = gameState.itemsData[selectedItem.itemId];
  const slot = itemData.equipment.slot;
  
  // Special handling for weapons (two weapon slots)
  if (slot === 'weapon') {
    return handleWeaponEquipping(selectedItem, gameState, gameDisplay, choiceModeManager);
  }
  
  // Check if slot is already occupied
  const existingItem = gameState.player.equipment[slot];
  
  if (existingItem) {
    // Slot is occupied - ask for confirmation
    choiceModeManager.setMode('yn', {
      action: 'equip',
      itemIndex: itemIndex,
      newItem: selectedItem,
      existingItem: existingItem,
      slot: slot
    });
    return false; // Don't complete the action yet
  } else {
    // Slot is free - equip immediately
    return equipItemDirectly(selectedItem, slot, gameState, gameDisplay, choiceModeManager);
  }
}

// Equip item with replacement (after YN confirmation)
export function equipItemWithReplacement(itemIndex, existingItem, slot, gameState, gameDisplay, choiceModeManager) {
  const availableEquipment = getAvailableEquipment(gameState);
  
  if (itemIndex < 0 || itemIndex >= availableEquipment.length) {
    addMessage('Invalid equipment selection.', gameState, gameState.player);
    return false;
  }

  const selectedItem = availableEquipment[itemIndex];
  
  // Unequip existing item and add to inventory
  if (existingItem) {
    // Remove equipment effects before unequipping
    const existingItemData = gameState.itemsData[existingItem.itemId];
    if (existingItemData && existingItemData.equipment && existingItemData.equipment.effect) {
      EffectManager.removeEffect(gameState.player, existingItemData.equipment.effect, 'equipment');
    }
    
    const unequippedItem = gameState.player.unequipItem(slot);
    if (unequippedItem) {
      // Try to add to inventory
      if (gameState.player.canAddToInventory()) {
        gameState.player.addToInventory(unequippedItem);
        addMessage(`Unequipped ${unequippedItem.name} and added to inventory.`, gameState, gameState.player);
      } else {
        // Inventory full - drop the item
        addMessage(`Unequipped ${unequippedItem.name} (inventory full, item dropped).`, gameState, gameState.player);
      }
    }
  }
  
  // Equip the new item
  return equipItemDirectly(selectedItem, slot, gameState, gameDisplay, choiceModeManager);
}

// Replace weapon in specific slot
export function replaceWeapon(weaponIndex, gameState, gameDisplay, choiceModeManager) {
  // This function will be called from NumericMode when user selects which weapon to replace
  // The context should contain the newItem and weapons array
  const context = choiceModeManager.getActionContext();
  
  if (!context || context.action !== 'weapon_replace') {
    addMessage('Invalid weapon replacement context.', gameState, gameState.player);
    return false;
  }
  
  const { newItem, weapons } = context;
  
  if (weaponIndex < 0 || weaponIndex >= weapons.length) {
    addMessage('Invalid weapon selection.', gameState, gameState.player);
    return false;
  }
  
  const selectedWeapon = weapons[weaponIndex];
  const slot = selectedWeapon.slot;
  const existingItem = selectedWeapon.item;
  
  // Unequip the existing weapon and add to inventory
  if (existingItem) {
    // Remove equipment effects before unequipping
    const existingItemData = gameState.itemsData[existingItem.itemId];
    if (existingItemData && existingItemData.equipment && existingItemData.equipment.effect) {
      EffectManager.removeEffect(gameState.player, existingItemData.equipment.effect, 'equipment');
    }
    
    const unequippedItem = gameState.player.unequipItem(slot);
    if (unequippedItem) {
      // Try to add to inventory
      if (gameState.player.canAddToInventory()) {
        gameState.player.addToInventory(unequippedItem);
        addMessage(`Unequipped ${unequippedItem.name} and added to inventory.`, gameState, gameState.player);
      } else {
        // Inventory full - drop the item
        addMessage(`Unequipped ${unequippedItem.name} (inventory full, item dropped).`, gameState, gameState.player);
      }
    }
  }
  
  // Equip the new weapon
  return equipItemDirectly(newItem, slot, gameState, gameDisplay, choiceModeManager);
}

// Remove equipment by index
export function removeEquipmentByIndex(itemIndex, gameState, gameDisplay, choiceModeManager) {
  const equippedItems = getEquippedItems(gameState);
  
  if (itemIndex < 0 || itemIndex >= equippedItems.length) {
    addMessage('Invalid equipment selection.', gameState, gameState.player);
    return false;
  }
  
  const selectedEquipment = equippedItems[itemIndex];
  const { item, slot, ringIndex } = selectedEquipment;
  
  // Check if inventory has space
  if (gameState.player.canAddToInventory()) {
    // Remove equipment effects before unequipping
    const itemData = gameState.itemsData[item.itemId];
    if (itemData && itemData.equipment && itemData.equipment.effect) {
      EffectManager.removeEffect(gameState.player, itemData.equipment.effect, 'equipment');
    }
    
    // Unequip and add to inventory
    const unequippedItem = gameState.player.unequipItem(slot, ringIndex);
    if (unequippedItem) {
      gameState.player.addToInventory(unequippedItem);
      addMessage(`Removed ${unequippedItem.name} and added to inventory.`, gameState, gameState.player);
      render(gameState, gameDisplay);
      updateUI(gameState, gameState.player, choiceModeManager);
      return true;
    }
  } else {
    // No inventory space - ask if player wants to drop it
    choiceModeManager.setMode('yn', {
      action: 'drop_equipment',
      item: item,
      slot: slot,
      ringIndex: ringIndex
    });
    return true;
  }
  
  return false;
}

// Remove equipment with drop confirmation
export function removeEquipmentWithDrop(item, slot, ringIndex, gameState, gameDisplay, choiceModeManager) {
  // Remove equipment effects before unequipping
  const itemData = gameState.itemsData[item.itemId];
  if (itemData && itemData.equipment && itemData.equipment.effect) {
    EffectManager.removeEffect(gameState.player, itemData.equipment.effect, 'equipment');
  }
  
  // Unequip the item
  const unequippedItem = gameState.player.unequipItem(slot, ringIndex);
  if (unequippedItem) {
    // Drop the item at player's location
    dropItem(unequippedItem, gameState);
    addMessage(`Removed ${unequippedItem.name} and dropped it on the ground.`, gameState, gameState.player);
    render(gameState, gameDisplay);
    updateUI(gameState, gameState.player, choiceModeManager);
    return true;
  }
  return false;
}

// Drop an item at the player's location
function dropItem(item, gameState) {
  const playerPos = gameState.getPlayerPosition();
  const currentLevel = gameState.currentLevel;
  
  // Add item to the current level
  currentLevel.addItem(playerPos.x, playerPos.y, item.itemId);
}

// Drop item from inventory by index
export function dropItemFromInventory(itemIndex, gameState, gameDisplay, choiceModeManager) {
  const inventory = gameState.player.inventory;
  
  if (itemIndex < 0 || itemIndex >= inventory.length) {
    addMessage('Invalid item selection.', gameState, gameState.player);
    return false;
  }
  
  const item = inventory[itemIndex];
  
  // Check if there's a container at the player's location
  const playerPos = gameState.getPlayerPosition();
  const currentLevel = gameState.currentLevel;
  const furnitureAtPosition = currentLevel.getFurnitureAt(playerPos.x, playerPos.y);
  
  if (furnitureAtPosition && furnitureAtPosition.isContainer()) {
    // There's a container - ask if player wants to place item in it
    choiceModeManager.setMode('yn', {
      action: 'place_in_container',
      item: item,
      itemIndex: itemIndex,
      furniture: furnitureAtPosition
    });
    return true;
  } else {
    // No container - drop item directly on the ground
    return dropItemWithContainerCheck(item, itemIndex, null, gameState, gameDisplay, choiceModeManager);
  }
}

// Drop item with container check (used by both direct drop and container placement)
export function dropItemWithContainerCheck(item, itemIndex, furniture, gameState, gameDisplay, choiceModeManager) {
  // Remove item from inventory
  const removedItem = gameState.player.removeFromInventory(itemIndex);
  
  if (!removedItem) {
    addMessage('Failed to remove item from inventory.', gameState, gameState.player);
    return false;
  }
  
  if (furniture && furniture.isContainer()) {
    // Place item in container
    const success = furniture.addItemToContainer(removedItem);
    if (success) {
      addMessage(`Placed ${removedItem.name} in ${furniture.getName()}.`, gameState, gameState.player);
    } else {
      // Container is full - drop on ground instead
      dropItem(removedItem, gameState);
      addMessage(`The ${furniture.getName()} is full. Dropped ${removedItem.name} on the ground.`, gameState, gameState.player);
    }
  } else {
    // Drop item on the ground
    dropItem(removedItem, gameState);
    addMessage(`Dropped ${removedItem.name} on the ground.`, gameState, gameState.player);
  }
  
  render(gameState, gameDisplay);
  updateUI(gameState, gameState.player, choiceModeManager);
  return true;
}

// Directly equip an item (internal helper)
function equipItemDirectly(item, slot, gameState, gameDisplay, choiceModeManager) {
  const itemData = gameState.itemsData[item.itemId];
  
  // Remove from inventory
  const itemIndex = gameState.player.inventory.findIndex(invItem => invItem === item);
  if (itemIndex !== -1) {
    gameState.player.removeFromInventory(itemIndex);
  }
  
  // Equip the item
  const success = gameState.player.equipItem(item, slot);
  
  if (success) {
    // Apply equipment effects
    if (itemData.equipment && itemData.equipment.effect) {
      EffectManager.applyEffect(gameState.player, itemData.equipment.effect, 'equipment');
    }
    
    addMessage(`Equipped ${item.name} in ${slot} slot.`, gameState, gameState.player);
    render(gameState, gameDisplay);
    updateUI(gameState, gameState.player, choiceModeManager);
    return true;
  } else {
    addMessage(`Failed to equip ${item.name}.`, gameState, gameState.player);
    return false;
  }
}

// Show a message (helper function for game actions)
export function showMessage(message, gameState) {
  addMessage(message, gameState, gameState.player);
}
