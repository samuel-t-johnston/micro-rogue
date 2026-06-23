import { createMenuShell } from './menu-shell.js';
import { createActionMenu } from './action-menu.js';
import { buildSettingsPage, buildCreditsPage } from './game-menu-items.js';

/**
 * @file In-game menu overlay, opened by the HUD gear button. Suppresses map input while open
 * (so turns don't advance — same mechanism as the character menu). Shares the drill-down list with
 * the main menu via createMenuShell; only the options and chrome differ.
 *
 * Options: Resume (close), New Game (confirm → onNewGame), Settings (sub-page), Credits (text page).
 * New Game routes through onNewGame, supplied by the game scene, which asks main.js to transition
 * into a fresh run.
 */

/** Creates the in-game menu overlay controller (see the file overview). */
export function createGameMenuController({ theme, getViewport, onNewGame }) {
  let open = false;
  let confirm = null; // a createActionMenu instance while confirming New Game

  function close() {
    open = false;
    confirm = null;
  }

  function askNewGame() {
    confirm = createActionMenu({
      theme,
      getViewport,
      title: 'Abandon current run?',
      actions: [
        { label: 'New Game', action: 'confirm' },
        { label: 'Cancel', action: null },
      ],
      onSelect: (action) => {
        confirm = null;
        if (action === 'confirm') {
          close();
          onNewGame?.();
        }
      },
    });
  }

  const shell = createMenuShell({
    theme,
    getViewport,
    onClose: close,
    getItems: () => [
      { id: 'resume', label: 'Resume', onSelect: close },
      { id: 'new', label: 'New Game', onSelect: askNewGame },
      { id: 'settings', label: 'Settings', submenu: buildSettingsPage() },
      { id: 'credits', label: 'Credits', submenu: buildCreditsPage() },
    ],
  });

  return {
    get isOpen() {
      return open;
    },

    open() {
      open = true;
      confirm = null;
      shell.reset();
    },
    close,

    render(ctx) {
      if (!open) return;
      shell.render(ctx);
      confirm?.render(ctx);
    },

    handleInput(event) {
      if (!open) return false;
      if (confirm) return confirm.handleInput(event);
      return shell.handleInput(event);
    },
  };
}
