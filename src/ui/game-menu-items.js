// Shared content for the game menu. Both mounts of the game menu — the launch scene
// (game-menu.js) and the in-game overlay (game-menu-controller.js) — surface the same
// application/system options, so anything common lives here to keep them from drifting.

// The Settings sub-page. A placeholder until M7 fills it in, at which point this becomes the
// single place to define it (and likely turns into a builder that reads/writes config).
export const SETTINGS_PAGE = { title: 'Settings', items: [], placeholder: 'Nothing here yet.' };
