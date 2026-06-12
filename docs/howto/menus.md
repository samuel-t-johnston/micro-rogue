# Menus

*The two menu systems in the engine — the **game menu** (application/system) and the **character
menu** (in-run gameplay) — what each is for, and how to add to them.*

## The two menus

They look similar but serve different jobs and never overlap in content.

| | **Game menu** | **Character menu** |
|---|---|---|
| Scope | Application / system — start, load, configure | The current run — inventory, equipment |
| Available | At launch (main menu) **and** in-game | In-game only |
| Layout | Centered vertical button list, drill-down | Responsive card grid, drill-down |
| Opened by | Main menu scene, or the ⚙ button (top-right) | The 👤 button (bottom-right) |
| Key files | [`menu-shell.js`](../../src/ui/menu-shell.js), [`game-menu.js`](../../src/ui/game-menu.js), [`game-menu-controller.js`](../../src/ui/game-menu-controller.js) | [`character-menu.js`](../../src/ui/character-menu.js), [`character-menu-controller.js`](../../src/ui/character-menu-controller.js) |

Rule of thumb: **anything that acts on the application or a save** (New Game, Continue, Settings)
is the game menu; **anything that acts on the player entity** (use an item, equip a weapon) is the
character menu. The character menu carries a comment to this effect at its head.

## Game menu

High-level actions: **New Game**, **Continue**, **Settings** (a placeholder sub-page for now).

The list itself lives in one reusable component, [`createMenuShell`](../../src/ui/menu-shell.js) — a
centered vertical button list that manages a page stack for drill-down. It's mounted in two places:

- **At launch** — [`createMenuScene`](../../src/ui/game-menu.js) is a top-level [AppState](../../src/engine/app-state.js)
  scene. It paints the `ROGµE` branding and hands the option list to the shell. **Continue** is
  enabled only when [`hasSave()`](../../src/save/save-system.js) is true; **New Game** asks to
  confirm an overwrite when a save already exists.
- **In-game** — [`createGameMenuController`](../../src/ui/game-menu-controller.js) wraps the same
  shell as a modal overlay, opened by the ⚙ [game-menu button](../../src/ui/widgets/game-menu-button.js).
  Here the return-to-game option is **Resume** (just closes the overlay), and **New Game** confirms
  "Abandon current run?" then routes through an `onNewGame` callback that asks
  [`main.js`](../../src/main.js) to transition into a fresh run.

The shell runs in two modes, chosen by whether an `onClose` is passed:

- **Scene mode** (no `onClose`) — no backdrop, no close button; unhandled taps pass through (the
  scene owns the background). Used by the main menu.
- **Overlay mode** (`onClose` set) — dims the scene, shows a ✕ close at the root, and is modal
  (swallows all input). Used by the in-game overlay.

New Game confirmations reuse [`createActionMenu`](../../src/ui/action-menu.js) — a small titled
button list with a Cancel row and tap-outside/Escape dismiss.

## Character menu

In-run gameplay only: inspect and act on the player entity. The root is a card grid (**Inventory**,
**Equipment**); each card drills into a sub-screen. [`character-menu.js`](../../src/ui/character-menu.js)
provides the chrome (`createCharacterMenuRoot`, `createCharacterMenuSubScreen`) and
[`character-menu-controller.js`](../../src/ui/character-menu-controller.js) wires the screens to the
player's [`inventory`/`wearsEquipment`](../../src/world/components.js) components, submitting game
actions (equip, drop, consume) back through the input controller. See [item.md](item.md) and
[equipment.md](equipment.md) for the content it operates on.

## Layout & HUD buttons

The four corners are claimed via [`anchor-system.js`](../../src/ui/anchor-system.js), so the buttons
never collide:

| Corner | Element |
|---|---|
| Top-left | HUD — HP / turn ([`hud.js`](../../src/ui/widgets/hud.js)) |
| Top-right | ⚙ game menu ([`game-menu-button.js`](../../src/ui/widgets/game-menu-button.js)) |
| Bottom-left | ≡ message log ([`message-log.js`](../../src/ui/widgets/message-log.js)) |
| Bottom-right | 👤 character menu ([`character-menu-button.js`](../../src/ui/widgets/character-menu-button.js)) |

The gear keeps the hamburger (≡/☰) reserved for the log. All buttons draw with the shared canvas
primitives in [`canvas-ui.js`](../../src/ui/canvas-ui.js).

## Add a menu item or sub-page

**To the game menu** — extend the `getItems()` array passed to `createMenuShell` (in
[`game-menu.js`](../../src/ui/game-menu.js) for launch, [`game-menu-controller.js`](../../src/ui/game-menu-controller.js)
for in-game). Each item is either:

```js
{ id, label, enabled, onSelect }                              // an action row
{ id, label, enabled, submenu: { title, items, placeholder } } // drills into a sub-page
```

`getItems()` is re-read every frame, so `enabled` can reflect live state (that's how Continue tracks
`hasSave()`). A `submenu` with empty `items` renders its `placeholder` string — that's all the
Settings page is today.

**To the character menu** — add a card in `createCharacterMenuRoot`'s `cards` list and a matching
sub-screen builder in the controller, following the Inventory/Equipment pair.

## Worth knowing

- **One list implementation, two menus.** The main menu and the in-game game menu render through the
  same `menu-shell`; only the chrome (branding vs. dimmed overlay) and the option wiring differ.
- **Menus pause the game for free.** While an overlay is open, the scene routes input to it, so the
  player's `player-get-input` goal stays blocked and the turn loop parks — no explicit pause flag.
  Same mechanism for both the game and character menus. See [turn-order.md](turn-order.md).
- **"Same options" isn't literal across contexts.** The return-to-game row is **Continue** (loads
  the save) on the main menu but **Resume** (closes the overlay) in-game — an in-game "load last
  save" would silently discard moves, so it's deliberately not offered.
- **New Game is guarded.** It confirms before discarding: "Overwrite existing save?" on the main
  menu (only when a save exists), "Abandon current run?" in-game (always).
- **Settings is a placeholder.** The drill-down chrome works; there are no settings to change yet.
