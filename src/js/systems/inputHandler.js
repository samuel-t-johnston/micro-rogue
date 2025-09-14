// Input handler class for managing user input
import { 
  movePlayer, 
  pickUpItem, 
  getAvailableItems, 
  pickUpItemByIndex, 
  useFurniture, 
  getAvailableEquipment, 
  equipItemByIndex, 
  equipItemWithReplacement, 
  replaceWeapon, 
  showMessage, 
  getEquippedItems, 
  removeEquipmentByIndex, 
  removeEquipmentWithDrop, 
  dropItemFromInventory, 
  dropItemWithContainerCheck, 
  getInventoryItems,
  getConsumableItems,
  consumeItemByIndex
} from '../core/gameLogic.js';

export class InputHandler {
  constructor(gameState, gameDisplay, choiceModeManager, updateGameUICallback) {
    this.gameState = gameState;
    this.gameDisplay = gameDisplay;
    this.choiceModeManager = choiceModeManager;
    this.updateGameUICallback = updateGameUICallback;
    this.isInitialized = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    // Create game actions here instead of receiving them
    this.gameActions = this.createGameActions();
  }

  createGameActions() {
    return {
      movePlayer: (dx, dy) => {
        movePlayer(dx, dy, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      pickUpItem: () => {
        pickUpItem(this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      getAvailableItems: () => {
        return getAvailableItems(this.gameState);
      },

      getInventoryItems: () => {
        return getInventoryItems(this.gameState);
      },

      pickUpItemByIndex: index => {
        return pickUpItemByIndex(index, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      useFurniture: (dx, dy) => {
        return useFurniture(dx, dy, this.gameState, this.gameDisplay, this.updateGameUICallback);
      },

      getAvailableEquipment: () => {
        return getAvailableEquipment(this.gameState);
      },

      equipItemByIndex: (itemIndex, modeManager) => {
        return equipItemByIndex(itemIndex, this.gameState, this.gameDisplay, modeManager);
      },

      equipItemWithReplacement: (itemIndex, existingItem, slot) => {
        return equipItemWithReplacement(itemIndex, existingItem, slot, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      replaceWeapon: (weaponIndex) => {
        return replaceWeapon(weaponIndex, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      showMessage: (message) => {
        showMessage(message, this.gameState);
      },

      getEquippedItems: () => {
        return getEquippedItems(this.gameState);
      },

      removeEquipmentByIndex: (itemIndex) => {
        return removeEquipmentByIndex(itemIndex, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      removeEquipmentWithDrop: (item, slot, ringIndex) => {
        return removeEquipmentWithDrop(item, slot, ringIndex, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      dropItemFromInventory: (itemIndex) => {
        return dropItemFromInventory(itemIndex, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      dropItemWithContainerCheck: (item, itemIndex, furniture) => {
        return dropItemWithContainerCheck(item, itemIndex, furniture, this.gameState, this.gameDisplay, this.choiceModeManager);
      },

      getConsumableItems: () => {
        return getConsumableItems(this.gameState);
      },

      consumeItemByIndex: (itemIndex) => {
        return consumeItemByIndex(itemIndex, this.gameState, this.gameDisplay, this.choiceModeManager);
      },
    };
  }

  init() {
    if (this.isInitialized) {
      return;
    }

    document.addEventListener('keydown', this.handleKeyDown);

    this.isInitialized = true;
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.isInitialized = false;
  }

  updateGameState(newGameState) {
    this.gameState = newGameState;
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();

    // Handle input through choice mode manager
    const handled = this.choiceModeManager.handleInput(
      key,
      this.gameState,
      this.gameDisplay,
      this.gameActions
    );

    if (handled) {
      // Only prevent default behavior for keys that the game actually handled
      event.preventDefault();
    }

    if (!handled) {
      // Invalid input for current mode - could add feedback here if needed
      console.log(
        `Invalid input '${key}' for current mode: ${this.choiceModeManager.getCurrentMode()}`
      );
    }
  }
}
