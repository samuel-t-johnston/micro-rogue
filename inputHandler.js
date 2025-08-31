// Input handler class for managing user input
export class InputHandler {
  constructor(gameState, gameDisplay, gameActions, choiceModeManager) {
    this.gameState = gameState;
    this.gameDisplay = gameDisplay;
    this.gameActions = gameActions;
    this.choiceModeManager = choiceModeManager;
    this.isInitialized = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    if (this.isInitialized) {
      return;
    }

    document.addEventListener('keydown', this.handleKeyDown);

    // New game menu listener
    document.addEventListener('newGameRequested', () => {
      this.gameActions.startNewGame();
    });

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
