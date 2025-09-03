import { BaseMode } from './BaseMode.js';

// Directional mode for choosing directions (e.g., for use actions)
export class DirectionalMode extends BaseMode {
  constructor() {
    super();
    this.validKeys = [
      'w',
      'a',
      's',
      'd',
      'q',
      'e',
      'z',
      'c',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'escape',
    ];
  }

  handleInput(key, context, gameState, gameDisplay, gameActions, modeManager) {
    const directionMap = {
      w: { dx: 0, dy: -1 },
      arrowup: { dx: 0, dy: -1 },
      s: { dx: 0, dy: 1 },
      arrowdown: { dx: 0, dy: 1 },
      a: { dx: -1, dy: 0 },
      arrowleft: { dx: -1, dy: 0 },
      d: { dx: 1, dy: 0 },
      arrowright: { dx: 1, dy: 0 },
      q: { dx: -1, dy: -1 },
      e: { dx: 1, dy: -1 },
      z: { dx: -1, dy: 1 },
      c: { dx: 1, dy: 1 },
    };

    if (key.toLowerCase() === 'escape') {
      modeManager.resetToDefault();
      return true;
    }

    const direction = directionMap[key.toLowerCase()];
    if (!direction) {
      return false;
    }

    // Execute the action based on context
    if (context && context.action === 'use') {
      const success = gameActions.useFurniture(direction.dx, direction.dy);
      if (success) {
        modeManager.resetToDefault();
      } else {
        // If not successful, stay in directional mode to allow retry
      }
    }

    return true;
  }

  getDisplayText(context) {
    if (context && context.action === 'use') {
      return 'Use - What would you like to use?';
    }
    return 'Choose direction';
  }

  getControlInstructions(context) {
    return [
      { label: 'Choose direction:', keys: 'WASD, QEZC, or Arrow Keys' },
      { label: 'ESC:', keys: 'Cancel' }
    ];
  }
}
