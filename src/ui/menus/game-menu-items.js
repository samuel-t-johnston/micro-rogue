/**
 * @file Shared content for the game menu. Both mounts of the game menu — the launch scene
 * (game-menu.js) and the in-game overlay (game-menu-controller.js) — surface the same
 * application/system options, so anything common lives here to keep them from drifting.
 */

import { gameSettings } from '../../engine/config/settings.js';
import { setAudioVolume } from '../../audio/audio-settings.js';

// Discrete volume steps for the audio segmented controls (the settings UI has no slider). Values must
// match the stored setting exactly so the active segment highlights.
const VOLUME_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: 'Low', value: 0.33 },
  { label: 'Med', value: 0.66 },
  { label: 'Full', value: 1 },
];

// One audio volume row, bound to its gameSettings key and re-pushed to the audio layer on change.
const volumeRow = (id, label, description) => ({
  id,
  label,
  description,
  options: VOLUME_OPTIONS,
  get: () => gameSettings.get(id),
  set: (v) => setAudioVolume(id, v),
});

/**
 * Builds the Settings sub-page: rows (label + optional description + a segmented control), rendered
 * by settings-controls.js via menu-shell. Each row binds to gameSettings: `get` is read every frame
 * so the active segment tracks live state, and selecting a segment persists immediately via `set`.
 */
export function buildSettingsPage() {
  return {
    title: 'Settings',
    rows: [
      {
        id: 'handedness',
        label: 'Handedness',
        description: 'Which side of the screen the primary action button sits on.',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        get: () => gameSettings.get('handedness'),
        set: (v) => gameSettings.set('handedness', v),
      },
      {
        id: 'skipNewGameInstructions',
        label: 'Skip new game instructions',
        description: 'Start a new run without the welcome screen.',
        options: [
          { label: 'On', value: true },
          { label: 'Off', value: false },
        ],
        get: () => gameSettings.get('skipNewGameInstructions'),
        set: (v) => gameSettings.set('skipNewGameInstructions', v),
      },
      {
        id: 'renderMode',
        label: 'Graphics',
        description: 'Sprite art, or classic ASCII glyphs.',
        options: [
          { label: 'Sprites', value: 'sprite' },
          { label: 'ASCII', value: 'glyph' },
        ],
        get: () => gameSettings.get('renderMode'),
        set: (v) => gameSettings.set('renderMode', v),
      },
      volumeRow('masterVolume', 'Master volume', 'Overall audio level.'),
      volumeRow('sfxVolume', 'Sound effects', 'Volume of interface and gameplay sounds.'),
      volumeRow('musicVolume', 'Music', 'Volume of background music.'),
    ],
  };
}

/** Builds the Credits sub-page: a static text page (menu-shell renders `text` as a centered block). */
export function buildCreditsPage() {
  return {
    title: 'Credits',
    text: '-- Code --\nSam Johnston\n\n-- Music --\nSamuel F Johanns\n\n--SFX--\nFreesound Community\n\n-- Pixel Art (and Inspiration) --\nProject Utumno/DCSS Artists\nELV Games\nMerchant-Shade\nGlionox\nCraftPix\nKenny Vleugels',
  };
}
