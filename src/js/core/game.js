// Import modules
import { initGame, saveGame, loadGame, hasSaveData, deleteSave } from './gameLogic.js';
import { updateUI, initUI, updateMenuState } from '../ui/ui.js';
import { render } from '../systems/renderer.js';
import { GameState } from './gameState.js';
import { InputHandler } from '../systems/inputHandler.js';
import { ChoiceModeManager } from '../systems/choiceModeManager.js';

let gameState = new GameState();
const gameDisplay = document.getElementById('gameDisplay');

function updateGameUI() {
  if (gameState && gameState.player) {
    updateUI(gameState, gameState.player, choiceModeManager);
  }
}

const choiceModeManager = new ChoiceModeManager(updateGameUI);

// Input handler
const inputHandler = new InputHandler(
  gameState,
  gameDisplay,
  choiceModeManager,
  updateGameUI
);

// Start new game function
async function startNewGame() {
  gameState = await initGame();

  // Update input handler with new game state
  inputHandler.updateGameState(gameState);

  // Render and update UI
  render(gameState, gameDisplay);
  updateUI(gameState, gameState.player, choiceModeManager);
  
  // Update menu state (new game means no save data initially)
  updateMenuState(false);
}

// Save game function
function saveCurrentGame() {
  if (gameState) {
    saveGame(gameState);
    // Update menu state after saving
    updateMenuState(true);
  }
}

// Load game function
async function loadSavedGame() {
  const loadedState = loadGame();
  if (loadedState) {
    // Load items and furniture data
    const { loadItems, loadFurniture } = await import('./gameLogic.js');
    loadedState.itemsData = await loadItems();
    loadedState.furnitureData = await loadFurniture();
    
    gameState = loadedState;
    
    // Update input handler with loaded game state
    inputHandler.updateGameState(gameState);
    
    // Render and update UI
    render(gameState, gameDisplay);
    updateUI(gameState, gameState.player, choiceModeManager);
    
    // Update menu state
    updateMenuState(true);
  }
}

// Delete save function
function deleteSaveData() {
  deleteSave();
  updateMenuState(false);
  // Show confirmation message
  if (gameState && gameState.player) {
    // Import addMessage dynamically
    import('../ui/ui.js').then(({ addMessage }) => {
      addMessage('Save data deleted!', gameState, gameState.player);
    });
  }
}

// Add menu event listeners
function addMenuEventListeners() {
  // Handle new game requests from the menu
  document.addEventListener('newGameRequested', () => {
    startNewGame().catch(console.error);
  });
  
  // Handle save game requests from the menu
  document.addEventListener('saveGameRequested', () => {
    saveCurrentGame();
  });
  
  // Handle load game requests from the menu
  document.addEventListener('loadGameRequested', () => {
    loadSavedGame().catch(console.error);
  });
  
  // Handle delete save requests from the menu
  document.addEventListener('deleteSaveRequested', () => {
    deleteSaveData();
  });
}

// Start the game when page loads
window.addEventListener('load', async () => {
  // Initialize input handler
  inputHandler.init();

  // Initialize UI
  initUI();

  // Add menu event listeners
  addMenuEventListeners();

  // Check for save data and load if available, otherwise start new game
  if (hasSaveData()) {
    try {
      await loadSavedGame();
    } catch (error) {
      console.error('Failed to load save data, starting new game:', error);
      await startNewGame();
    }
  } else {
    await startNewGame();
  }
  
  // Update menu state based on save data availability
  updateMenuState(hasSaveData());
});
