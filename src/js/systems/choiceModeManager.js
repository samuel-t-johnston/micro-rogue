import { defaultModeRegistry } from './choiceModes/index.js';

// Choice mode manager to handle different input states
export class ChoiceModeManager {
  constructor(onModeChange = null) {
    this.currentMode = 'default';
    this.actionContext = null;
    this.onModeChange = onModeChange;
    this.modeRegistry = defaultModeRegistry;
    this.currentModeInstance = null;
  }

  // Set the current choice mode and context
  setMode(mode, context = null) {
    this.currentMode = mode;
    this.actionContext = context;
    this.currentModeInstance = null; // Clear cached instance
    if (this.onModeChange) {
      this.onModeChange();
    }
  }

  // Reset to default mode
  resetToDefault() {
    this.currentMode = 'default';
    this.actionContext = null;
    this.currentModeInstance = null; // Clear cached instance
    if (this.onModeChange) {
      this.onModeChange();
    }
  }

  // Get current mode
  getCurrentMode() {
    return this.currentMode;
  }

  // Get current action context
  getActionContext() {
    return this.actionContext;
  }

  // Check if currently in a special mode (not default)
  isInSpecialMode() {
    return this.currentMode !== 'default';
  }

  // Handle input based on current mode
  handleInput(key, gameState, gameDisplay, gameActions) {
    // Get or create the current mode instance
    if (!this.currentModeInstance) {
      try {
        this.currentModeInstance = this.modeRegistry.getMode(this.currentMode);
      } catch (error) {
        console.error(`Unknown choice mode: ${this.currentMode}`, error);
        return false;
      }
    }

    // Check if key is valid for current mode
    if (!this.currentModeInstance.isValidKey(key)) {
      return false;
    }

    // Handle the input
    return this.currentModeInstance.handleInput(
      key,
      this.actionContext,
      gameState,
      gameDisplay,
      gameActions,
      this
    );
  }

  // Get display text for current mode
  getModeDisplayText() {
    // Get or create the current mode instance
    if (!this.currentModeInstance) {
      try {
        this.currentModeInstance = this.modeRegistry.getMode(this.currentMode);
      } catch (error) {
        console.error(`Unknown choice mode: ${this.currentMode}`, error);
        return null;
      }
    }

    return this.currentModeInstance.getDisplayText(this.actionContext);
  }

  // Get control instructions for current mode
  getModeControlInstructions() {
    // Get or create the current mode instance
    if (!this.currentModeInstance) {
      try {
        this.currentModeInstance = this.modeRegistry.getMode(this.currentMode);
      } catch (error) {
        console.error(`Unknown choice mode: ${this.currentMode}`, error);
        return [];
      }
    }

    return this.currentModeInstance.getControlInstructions(this.actionContext);
  }
}
