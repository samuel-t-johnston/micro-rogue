// Shared content for the game menu. Both mounts of the game menu — the launch scene
// (game-menu.js) and the in-game overlay (game-menu-controller.js) — surface the same
// application/system options, so anything common lives here to keep them from drifting.

import { gameSettings } from '../engine/settings.js';

function handednessLabel() {
  return `Handedness: ${gameSettings.get('handedness') === 'left' ? 'Left' : 'Right'}`;
}

// The Settings sub-page. Built fresh each time the menu re-reads its items so labels reflect
// current settings. The handedness row is a toggle: selecting it flips the setting (persisted
// immediately) and rewrites its own label in place, so the change shows without leaving the
// sub-page (menu-shell renders each item's live `label`).
export function buildSettingsPage() {
  const handedness = {
    id: 'handedness',
    label: handednessLabel(),
    onSelect() {
      const next = gameSettings.get('handedness') === 'left' ? 'right' : 'left';
      gameSettings.set('handedness', next);
      handedness.label = handednessLabel();
    },
  };
  return { title: 'Settings', items: [handedness], placeholder: 'Nothing here yet.' };
}
