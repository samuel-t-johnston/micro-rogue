// Import modules
import { movePlayer, initGame, pickUpItem, useFurniture, getAvailableItems, pickUpItemByIndex } from './gameLogic.js';
import { updateUI, initUI } from './ui.js';
import { render } from './renderer.js';
import { GameState } from './gameState.js';
import { InputHandler } from './inputHandler.js';
import { ChoiceModeManager } from './choiceModeManager.js';

// Game state
let gameState = new GameState();

// Game display element
const gameDisplay = document.getElementById('gameDisplay');

// UI update function
function updateGameUI() {
  if (gameState && gameState.player) {
    updateUI(gameState, gameState.player, choiceModeManager);
  }
}

// Choice mode manager
const choiceModeManager = new ChoiceModeManager(updateGameUI);

// Game actions object to pass to InputHandler
const gameActions = {
  movePlayer: (dx, dy) => {
    movePlayer(dx, dy, gameState, gameDisplay, choiceModeManager);
  },
  
  pickUpItem: () => {
    pickUpItem(gameState, gameDisplay, choiceModeManager);
  },
  
  getAvailableItems: () => {
    return getAvailableItems(gameState);
  },
  
  pickUpItemByIndex: (index) => {
    return pickUpItemByIndex(index, gameState, gameDisplay, choiceModeManager);
  },
  
  useFurniture: (dx, dy) => {
    return useFurniture(dx, dy, gameState, gameDisplay, updateGameUI);
  },
  
  startNewGame: async () => {
    await startNewGame();
  }
};

// Input handler
const inputHandler = new InputHandler(gameState, gameDisplay, gameActions, choiceModeManager);

// Start new game function
async function startNewGame() {
  gameState = await initGame();
  
  // Update input handler with new game state
  inputHandler.updateGameState(gameState);

  // Render and update UI
  render(gameState, gameDisplay);
  updateUI(gameState, gameState.player, choiceModeManager);
}

// Start the game when page loads
window.addEventListener('load', () => {
  // Initialize input handler
  inputHandler.init();
  
  // Initialize UI
  initUI();
  
  // Start the game
  startNewGame().catch(console.error);
});
