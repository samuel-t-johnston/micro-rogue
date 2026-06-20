// Shared content for the game menu. Both mounts of the game menu — the launch scene
// (game-menu.js) and the in-game overlay (game-menu-controller.js) — surface the same
// application/system options, so anything common lives here to keep them from drifting.

import { gameSettings } from '../engine/settings.js';

// The Settings sub-page. Returns rows (label + optional description + a segmented control), rendered
// by settings-controls.js via menu-shell. Each row binds to gameSettings: `get` is read every frame
// so the active segment tracks live state, and selecting a segment persists immediately via `set`.
export function buildSettingsPage() {
  return {
    title: 'Settings',
    rows: [
      {
        id: 'handedness',
        label: 'Handedness',
        description: 'Which side of the screen the primary action button sits on.',
        options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }],
        get: () => gameSettings.get('handedness'),
        set: (v) => gameSettings.set('handedness', v),
      },
      {
        id: 'skipNewGameInstructions',
        label: 'Skip new game instructions',
        description: 'Start a new run without the welcome screen.',
        options: [{ label: 'On', value: true }, { label: 'Off', value: false }],
        get: () => gameSettings.get('skipNewGameInstructions'),
        set: (v) => gameSettings.set('skipNewGameInstructions', v),
      },
    ],
  };
}
