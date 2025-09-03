// Import modules
import { initGame } from './gameLogic.js';
import { updateUI, initUI } from '../ui/ui.js';
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
}

// Add menu event listeners
function addMenuEventListeners() {
  // Handle new game requests from the menu
  document.addEventListener('newGameRequested', () => {
    startNewGame().catch(console.error);
  });
  
  // Future menu actions can go here
}

// Start the game when page loads
window.addEventListener('load', () => {
  // Initialize input handler
  inputHandler.init();

  // Initialize UI
  initUI();

  // Add menu event listeners
  addMenuEventListeners();

  // Start the game
  startNewGame().catch(console.error);
});
