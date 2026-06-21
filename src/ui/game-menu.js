import { hasSave } from '../save/save-system.js';
import { drawText } from './canvas-ui.js';
import { createMenuShell } from './menu-shell.js';
import { createActionMenu } from './action-menu.js';
import { buildSettingsPage, buildCreditsPage } from './game-menu-items.js';

// Main menu scene. The option list and Settings drill-down come from the shared menu-shell
// (same component the in-game menu uses); the scene only adds the ROGµE branding/background.
//
// New Game overwrites any existing save, so it confirms first when one is present. Continue is
// enabled only when there is a save to load. onAction('new'|'continue') is handled by main.js.

export function createMenuScene({ theme, getViewport, onAction }) {
  let confirm = null; // a createActionMenu instance while confirming an overwrite

  function askOverwrite() {
    confirm = createActionMenu({
      theme, getViewport,
      title: 'Overwrite existing save?',
      actions: [
        { label: 'New Game', action: 'confirm' },
        { label: 'Cancel', action: null },
      ],
      onSelect: (action) => {
        confirm = null;
        if (action === 'confirm') onAction?.('new');
      },
    });
  }

  const shell = createMenuShell({
    theme, getViewport,
    getItems: () => [
      { id: 'new', label: 'New Game', onSelect: () => (hasSave() ? askOverwrite() : onAction?.('new')) },
      { id: 'continue', label: 'Continue', enabled: hasSave(), onSelect: () => onAction?.('continue') },
      { id: 'settings', label: 'Settings', submenu: buildSettingsPage() },
      { id: 'credits', label: 'Credits', submenu: buildCreditsPage() },
    ],
  });

  return {
    render(ctx) {
      const { width, height } = getViewport();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      drawText(ctx, 'ROGµE', width / 2, Math.round(height * 0.18), {
        color: theme.text, size: 48, weight: '700', align: 'center', baseline: 'middle',
      });

      shell.render(ctx);
      confirm?.render(ctx);
    },

    handleInput(event) {
      if (confirm) return confirm.handleInput(event);
      return shell.handleInput(event);
    },
  };
}
