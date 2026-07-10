/**
 * @file The in-game scene: owns the per-run dungeon runtime — entity registry, level manager,
 * renderer/camera, turn loop, input controller, and the HUD/menu/dialog widgets — and routes render
 * and input among them. It also owns the run lifecycle: new-vs-continue load in enter(), autosave,
 * level transitions, and the single endGame() seam where death and victory converge.
 */
import { rng } from '../../engine/core/rng.js';
import { tileKey } from '../../engine/core/tile-key.js';
import { gameConfig } from '../../engine/config/game-config.js';
import { createRenderer } from '../../render/renderer.js';
import { panCamera } from '../../render/camera-pan.js';
import { createZoom, defaultZoomIndex } from '../../render/zoom.js';
import { animations } from '../../render/animations.js';
import { vignette } from '../../render/vignette.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createTurnManager } from '../../engine/turn/turn-manager.js';
import { createInputController } from '../../engine/core/input-controller.js';
import { createActionSystem } from '../../actions/core/action-system.js';
import { createPlayer } from '../../world/entities/player.js';
import { resolveArrival } from '../../world/map/spawn.js';
import { createLevelManager } from '../../world/dungeon/level-manager.js';
import transitMap from '../../../data/transit-map.js';
import { applySenses } from '../../ai/core/planning-context.js';
import { upkeep } from '../../engine/turn/upkeep.js';
import { syncSpeed } from '../../attributes/speed-sync.js';
import { winConditions, escapeWithQuestItem } from '../../engine/turn/win-conditions.js';
import { scentUpkeep, scentAt } from '../../world/sense-systems/scent.js';
import { tickHunger, hungerStatus } from '../../world/systems/hunger.js';
import { watchLevelUp } from '../../world/systems/level-up.js';
import { getTileType } from '../../world/map/tile-registry.js';
import { gameLog } from '../../engine/log/game-log.js';
import { isEntryVisible } from '../../engine/log/log-visibility.js';
import { createHudWidget } from '../widgets/hud.js';
import { createMessageLogWidget } from '../widgets/message-log.js';
import { createCharacterMenuButton } from '../widgets/character-menu-button.js';
import { createDialogController } from '../overlays/dialog-controller.js';
import { createCharacterMenuController } from '../menus/character-menu-controller.js';
import { createGameMenuController } from '../menus/game-menu-controller.js';
import { createGameMenuButton } from '../widgets/game-menu-button.js';
import { createOutcomePopup } from '../overlays/outcome-popup.js';
import { createContextMenu } from '../menus/context-menu.js';
import { drawText, drawButton, hitTest } from '../core/canvas-ui.js';
import { resolveTileActions } from '../../actions/core/resolve-tile-actions.js';
import { getAttackCapability } from '../../combat/weapons.js';
import { getPool, getAccumulator } from '../../attributes/attribute-access.js';
import { levelProgress } from '../../../data/attribute-set.js';
import { commitSave, loadSavedGame, clearSave } from '../../save/core/save-system.js';
import {
  buildSupportBundle,
  downloadSupportBundle,
} from '../../save/support-bundle/support-bundle.js';

// The steady edge glow held while the player is starving (see hungerStatus): a thin, deep-red frame.
const STARVING_VIGNETTE = { color: '#e0352f', alpha: 0.3 };

/**
 * Creates the in-game scene (see the file overview). `startMode` is 'new' or 'continue'; the host
 * callbacks (onGameOver, onNewGame, onLoadFailed) bridge to main.js / app-state transitions.
 */
export function createGameScene({
  theme,
  getViewport,
  onGameOver,
  onNewGame,
  onLoadFailed,
  startMode = 'new',
}) {
  let level = null;
  let player = null;
  let levelManager = null;
  let turnManager = null;
  let inputController = null;
  let gameOver = false;
  let outcome = 'lose'; // 'lose' | 'win' — how the run ended, set by endGame()
  let outcomeMessage = ''; // optional detail line carried to the Results screen
  let transitioning = false;
  let visibilityHandler = null;

  let registry = createEntityRegistry();
  // Touch devices (coarse pointer) start zoomed closer; mouse/desktop start wider. Session-only.
  const coarsePointer = !!(
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches
  );
  const zoom = createZoom({ index: defaultZoomIndex(coarsePointer) });
  const renderer = createRenderer({ getViewport, zoom });

  // Map-area gesture state (release-based tap-to-move + pinch-to-zoom). UI taps never reach
  // here — they're consumed by the widget chain in handleInput before a gesture can start.
  const pointers = new Map(); // active map-area pointers: id -> { x, y }
  let tapCandidate = null; // a single press that may become a move on release
  let pinch = null; // { baseDist } — two-finger zoom, ratcheted per step
  let pan = null; // { id, lastX, lastY } — one-finger drag panning the viewport
  // Camera follows the player ('follow') until a drag-to-pan switches to free-look ('free'); a
  // turn-finishing player action (handleTurnEnd) or a level change (mountLevel) snaps back to follow.
  let cameraMode = 'follow';
  // The player's hunger at the end of last turn — how the hunger tick tells a threshold *crossing*
  // from sitting below the line, and eating from the ordinary drain. Transient (re-seeded from the
  // live pool in mountLevel), so a crossing message never re-fires across a reload.
  let lastHunger = 0;
  const TAP_SLOP = 12; // px of drift that disqualifies a tap (and starts a drag-to-pan)
  const PINCH_STEP_RATIO = 1.25; // pinch distance change that advances one zoom level
  const LONGPRESS_MS = 450; // press-and-hold that raises the contextual tile menu (touch)
  let longPressTimer = null;
  let contextMenu = null; // the open contextual tile menu (modal popover), or null
  // Targeting mode for ranged actions (throw now; wands/spells later): { prompt, onPick, hoverTile }.
  // While set, a map tap resolves a target tile instead of moving, and the rest of the UI is inert.
  let targeting = null;

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function resetGestures() {
    pointers.clear();
    tapCandidate = null;
    pinch = null;
    pan = null;
    clearLongPress();
  }

  // Applies a one-finger drag (screen px) to the viewport, switching to free-look. Clamped to the
  // level so the map stays mostly on screen. See src/render/camera-pan.js.
  function panViewport(dxScreen, dyScreen) {
    if (!level) return;
    cameraMode = 'free';
    const { x, y } = panCamera(renderer.camera, dxScreen, dyScreen, renderer.tileSize, level);
    renderer.setCamera(x, y);
  }

  // Raise the contextual menu for the tile under a screen point (long-press or right-click). Builds
  // its rows from the same resolveTileActions the tap interpreter uses, so the offered actions match
  // what a tap would do. A tile with nothing to offer opens no menu. Hands gesture state to the modal.
  function openContextMenu(screenX, screenY) {
    if (!level || !inputController) return;
    const world = renderer.screenToWorld(screenX, screenY);
    const tile = { x: Math.floor(world.x), y: Math.floor(world.y) };
    const rows = resolveTileActions(level, getPlayerPos(), tile, getAttackCapability(player));
    if (rows.length === 0) return;
    resetGestures();
    contextMenu = createContextMenu({
      theme,
      getViewport,
      anchor: { x: screenX, y: screenY },
      rows,
      onSelect: (action) => {
        contextMenu = null;
        if (action) inputController.submit(action);
      },
    });
  }

  // Enters targeting mode: the next clean map tap inside the player's FOV resolves a target tile and
  // calls onPick; the on-screen Cancel button or Escape backs out. Reusable by any future targeted action.
  function beginTargeting({ prompt, onPick }) {
    resetGestures();
    contextMenu = null;
    targeting = { prompt, onPick, hoverTile: null };
  }

  function cancelTargeting() {
    targeting = null;
  }

  // True if a tile is currently visible to the player (targeting is restricted to FOV).
  function isTileVisible(x, y) {
    return !!player?.components.get('tilePerception')?.visible.has(tileKey(x, y));
  }

  // Draws the targeting overlay: a crosshair box on the hovered tile (red when out of FOV / invalid)
  // and a prompt banner near the top. No-op when not targeting.
  function renderTargeting(ctx) {
    if (!targeting) return;
    const tileSize = renderer.tileSize;
    const tile = targeting.hoverTile;
    if (tile) {
      const { x, y } = renderer.worldToScreen(tile.x, tile.y);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isTileVisible(tile.x, tile.y) ? theme.primary : '#e0352f';
      ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      ctx.restore();
    }
    const { width } = getViewport();
    const bw = Math.min(width - 32, targeting.prompt.length * 9 + 48);
    const bx = Math.round((width - bw) / 2);
    const by = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx, by, bw, 32);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 31);
    ctx.restore();
    drawText(ctx, targeting.prompt, width / 2, by + 16, {
      color: theme.text,
      size: 14,
      align: 'center',
      baseline: 'middle',
    });

    // A Cancel button under the banner so the action can be backed out by touch (Escape covers desktop).
    // Its screen rect is stashed for onPointerUp to hit-test before treating a tap as a target pick.
    const cw = 120;
    const ch = 36;
    const rect = { x: Math.round((width - cw) / 2), y: by + 40, w: cw, h: ch };
    drawButton(ctx, theme, { ...rect, label: 'Cancel' });
    targeting.cancelRect = rect;
  }

  // Routes an action submitted by the character menu. A throw arrives without coordinates: it opens
  // targeting and is submitted (with the picked tile) only once the player chooses a target. Every
  // other action goes straight to the input controller as before.
  function handleMenuAction(action) {
    if (action?.type === 'throw' && action.x == null) {
      const { itemEntityId } = action;
      beginTargeting({
        prompt: 'Choose a target',
        onPick: (tile) =>
          inputController?.submit({ type: 'throw', itemEntityId, x: tile.x, y: tile.y }),
      });
      return;
    }
    inputController?.submit(action);
  }

  function pinchDistance() {
    const [a, b] = pointers.values();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  // A press that fell through the UI chain: one finger begins a tap candidate, a second
  // finger turns the gesture into a pinch (and cancels the tap, so no move ever fires).
  function onPointerDown(event) {
    // Ignore secondary mouse buttons (right/middle) — right-click opens the menu via 'contextmenu',
    // so its pointerdown/up must not also start a tap-to-move. Touch presses report button 0.
    if (event.button > 0) return true;
    pointers.set(event.pointerId, { x: event.x, y: event.y });
    if (pointers.size === 1) {
      tapCandidate = { id: event.pointerId, x: event.x, y: event.y };
      // Hold this press still long enough and it becomes a contextual menu instead of a move — but
      // not while targeting, where a press can only resolve (or miss) a target tile.
      const { x, y, pointerId } = event;
      clearLongPress();
      if (!targeting) {
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          if (tapCandidate?.id === pointerId) openContextMenu(x, y); // resetGestures() clears tapCandidate
        }, LONGPRESS_MS);
      }
    } else if (pointers.size === 2) {
      tapCandidate = null;
      pan = null; // a second finger ends the drag and begins a pinch; the view stays where panned
      clearLongPress();
      pinch = { baseDist: pinchDistance() };
    }
    return true;
  }

  function onPointerMove(event) {
    const p = pointers.get(event.pointerId);
    if (!p) return false; // hover, or a press the UI consumed — not a tracked gesture
    p.x = event.x;
    p.y = event.y;
    if (pinch && pointers.size >= 2) {
      // Ratchet: each time the fingers spread/pinch past the step ratio, advance one level
      // and re-baseline, so a continuous pinch walks through the discrete snap points.
      const dist = pinchDistance();
      if (dist >= pinch.baseDist * PINCH_STEP_RATIO) {
        renderer.zoomIn();
        pinch.baseDist = dist;
      } else if (dist <= pinch.baseDist / PINCH_STEP_RATIO) {
        renderer.zoomOut();
        pinch.baseDist = dist;
      }
    } else if (pan?.id === event.pointerId) {
      // An in-progress drag: shift the viewport by the per-move delta and re-baseline.
      panViewport(event.x - pan.lastX, event.y - pan.lastY);
      pan.lastX = event.x;
      pan.lastY = event.y;
    } else if (
      tapCandidate?.id === event.pointerId &&
      Math.hypot(event.x - tapCandidate.x, event.y - tapCandidate.y) > TAP_SLOP
    ) {
      // Dragged too far to be a tap or long-press — promote it to a drag-to-pan instead.
      pan = { id: event.pointerId, lastX: event.x, lastY: event.y };
      tapCandidate = null;
      clearLongPress();
    }
    return true;
  }

  // Release: a still-valid single-finger tap becomes the move action at the released tile.
  function onPointerUp(event) {
    const releasingTap = tapCandidate?.id === event.pointerId;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pan?.id === event.pointerId) pan = null; // drag ended; stay in free-look until the next turn
    clearLongPress(); // released (or cancelled) before the hold elapsed — no menu
    if (releasingTap) {
      tapCandidate = null;
      const world = renderer.screenToWorld(event.x, event.y);
      const tile = { x: Math.floor(world.x), y: Math.floor(world.y) };
      if (targeting) {
        // A tap on the Cancel button backs out; otherwise it's a target pick — resolve the tile if
        // it's in view, else ignore and keep targeting.
        if (targeting.cancelRect && hitTest(targeting.cancelRect, event.x, event.y)) {
          cancelTargeting();
        } else if (isTileVisible(tile.x, tile.y)) {
          const { onPick } = targeting;
          cancelTargeting();
          onPick(tile);
        }
      } else {
        // A raw tile tap; the player-get-input goal interprets it (move / attack / interact / pick up).
        inputController.submit({ type: 'tap', x: tile.x, y: tile.y });
      }
    }
    return true;
  }

  // Wheel up zooms in (closer), wheel down zooms out (wider).
  function onWheel(deltaY) {
    if (deltaY < 0) renderer.zoomIn();
    else if (deltaY > 0) renderer.zoomOut();
    return true;
  }
  const messageLogWidget = createMessageLogWidget({
    theme,
    getViewport,
    getDisplayEntries: (count) => gameLog.getDisplayEntries(count),
    getAllEntries: () => gameLog.getAll(),
    isDebugEnabled: () => gameConfig.debugEnabled,
  });
  const dialogController = createDialogController({ theme, getViewport });
  const characterMenuController = createCharacterMenuController({
    theme,
    getViewport,
    getPlayer: () => player,
    onAction: (action) => handleMenuAction(action),
  });
  const hudWidget = createHudWidget({
    theme,
    getViewport,
    onOpen: () => characterMenuController.openStats(),
  });
  const characterMenuButton = createCharacterMenuButton({
    theme,
    getViewport,
    onOpen: () => characterMenuController.open(),
  });
  const gameMenuController = createGameMenuController({
    theme,
    getViewport,
    onNewGame: () => onNewGame?.(),
  });
  const gameMenuButton = createGameMenuButton({
    theme,
    getViewport,
    onOpen: () => gameMenuController.open(),
  });
  const outcomePopup = createOutcomePopup({
    theme,
    getViewport,
    onNext: () => {
      onGameOver?.({
        outcome,
        message: outcomeMessage,
        turns: turnManager?.playerTurnCount ?? 0,
        player,
        level,
      });
    },
  });

  function getPlayerPos() {
    return registry.getComponent(player, 'position');
  }

  // Visibility provider for the game log (wired in enter()). Decides, at write-time,
  // whether the player could perceive an entry — so monsters fighting behind a closed
  // door don't leak into the message log. FOV knowledge lives only here; the policy
  // itself is the pure isEntryVisible() helper, and log call sites stay agnostic and
  // just pass the entity ids (`actor`/`target`) they already carry.
  function isEntryVisibleToPlayer(entry) {
    return isEntryVisible(entry, {
      playerId: player?.id,
      visibleTiles: player?.components.get('tilePerception')?.visible,
      getPosition: (id) => registry.getEntity(id)?.components.get('position'),
    });
  }

  // Snapshots the settled game to the single save slot. Called at the player's turn-start
  // (via the turn manager) and on tab-hide. Guarded so a dead game is never persisted and
  // teardown can't race a write.
  function saveGame() {
    if (gameOver || !level || !player) return;
    commitSave({
      registry,
      level,
      player,
      turnCount: turnManager?.playerTurnCount ?? 0,
      ...levelManager.snapshot(),
    });
  }

  // The single end-of-run seam: both player death and victory converge here. Deletes the save (the
  // run is over either way — never persist a finished game), freezes the turn loop, and surfaces the
  // outcome popup over the frozen scene. `gameOver` guards against re-entry and gates autosave.
  function endGame({ outcome: result, message = '' }) {
    if (gameOver) return;
    gameOver = true;
    outcome = result;
    outcomeMessage = message;
    turnManager?.stop();
    clearSave();
    outcomePopup.show(result);
  }

  // Wired into the level by mountLevel(); fired from the death chokepoint when the player's HP hits 0.
  function handlePlayerDeath() {
    endGame({ outcome: 'lose' });
  }

  // Wired into the turn manager as onTurnEnd; evaluates win conditions at the end of each real player
  // turn (win state only changes on the player's own action). A hit ends the run as a victory.
  function handleTurnEnd(entity, { free }) {
    if (gameOver || free || !entity.components.has('playerControlled')) return;
    cameraMode = 'follow'; // a turn-finishing player action snaps the viewport back to the player
    // Hunger drains once per turn-consuming player action; may bite (and even kill) at empty, so tick
    // it before the win check but after the action has resolved.
    lastHunger = tickHunger(player, level, registry, lastHunger);
    if (gameOver) return; // a starvation bite may have ended the run
    const result = winConditions.run({ registry, level, player });
    if (result) endGame(result);
  }

  // Wires the per-level runtime (senses, camera, input, action system, turn loop) onto the current
  // `level` and starts the turn loop. Shared by the initial load and every level transition, so the
  // two paths can't drift. `initialTurnCount` carries the player's turn count across a transition.
  function mountLevel({ initialTurnCount = 0 } = {}) {
    level.onPlayerDeath = handlePlayerDeath;
    level.onTransition = requestTransition;
    applySenses(player, level);
    lastHunger = getPool(player, 'hunger').current; // baseline for this level's hunger crossings

    const ppos = registry.getComponent(player, 'position');
    cameraMode = 'follow'; // a new floor recenters on the player, dropping any free-look pan
    renderer.setCamera(ppos.x, ppos.y);

    inputController = createInputController();
    targeting = null;
    resetGestures();
    const actionSystem = createActionSystem({ level, inputController, registry, dialogController });

    // Per-player-turn upkeep (see src/engine/turn/upkeep.js). Order matters: scent diffuses before the
    // autosave so a reload restores the up-to-date field. Steps read the current level from context.
    upkeep.register('scent', (ctx) => scentUpkeep(ctx.level, ctx.registry));
    upkeep.register('autosave', () => saveGame());

    // The classic victory: escape the dungeon (stand on a dungeonExit) carrying the Amulet of Yendor.
    // Registered here so the win check is live for every floor; evaluated at each player turn-end.
    winConditions.register(
      'escape-with-amulet',
      escapeWithQuestItem('amulet-of-yendor', 'You escaped the dungeon with the Amulet of Yendor!'),
    );

    turnManager = createTurnManager({
      // Turn-queue membership = takes turns OR decays. turnTakers act on the energy model;
      // decay entities (sounds, etc.) ride the same queue purely to age out once per round.
      getActiveEntities: () => {
        const members = new Set(registry.getEntitiesWith('turnTaker'));
        for (const e of registry.getEntitiesWith('decay')) members.add(e);
        return [...members];
      },
      invokeAction: (entity) => actionSystem.invokeAction(entity),
      onTurnStart: (entity) => {
        // Refresh derived turn speed from the entity's attributes before it acts — the sanctioned
        // per-entity poll point (see speed-sync.js). Takes effect next queue pass, per turn-order.md.
        syncSpeed(entity);
        if (entity.components.has('playerControlled')) upkeep.run({ level, registry, player });
      },
      onTurnEnd: (entity, meta) => {
        // Any entity that grows on level-up is reconciled at its own turn boundary, after the XP it
        // may have earned this turn has landed (poll-not-listen; see level-up.js). handleTurnEnd then
        // runs the player-only end-of-turn checks (hunger, win conditions).
        watchLevelUp(entity);
        handleTurnEnd(entity, meta);
      },
      // Emergency breaker tripped: a creature's goal stack kept returning free actions. Surface it
      // loudly (console) and in the debug log so the offending entity is findable; the turn loop has
      // already force-consumed the turn to stay responsive.
      onFreeActionLimit: (entity, count) => {
        const name = entity.components.get('name') ?? `#${entity.id}`;
        console.warn(`[turn] ${name} hit the free-action limit (${count}); forcing turn consumed.`);
        gameLog.add({
          actor: entity.id,
          action: 'freeActionLimit',
          count,
          name,
        });
      },
      initialTurnCount,
    });
    gameLog.setTurnProvider(() => turnManager?.playerTurnCount ?? 0);
    gameLog.setVisibilityProvider(isEntryVisibleToPlayer);
    turnManager.start();
  }

  // Wired into each level as `level.onTransition`; fired from the self-interact action when the
  // player taps the tile they're standing on and it holds stairs. Stops the current turn loop and
  // defers the actual swap to a macrotask so the in-flight player turn fully unwinds before the
  // level is frozen out from under it.
  function requestTransition(transitionEntity) {
    if (transitioning || gameOver) return;
    transitioning = true;
    turnManager?.stop();
    setTimeout(() => performTransition(transitionEntity), 0);
  }

  // Freezes the current floor, generates or thaws the destination, lands the player, and remounts
  // the turn loop on the new floor. A no-op port (an inert/edge stair) just remounts the current
  // floor so play resumes. Saves once the new floor is settled.
  async function performTransition(transitionEntity) {
    try {
      const port = transitionEntity.components.get('transition').port;
      const turns = turnManager?.playerTurnCount ?? 0;
      const newLevel = await levelManager.travel(player, port);
      if (newLevel) {
        level = newLevel;
        // Per-floor fog of war is swapped by levelManager.travel (it freezes the departed floor's
        // remembered tiles into cold storage and restores the destination's). mountLevel's applySenses
        // recomputes what's currently visible on arrival.
        gameLog.add({
          display:
            port === 'down' ? 'You descend deeper into the dungeon.' : 'You climb the stairs.',
        });
      }
      mountLevel({ initialTurnCount: turns }); // also re-centres the camera on the player
      saveGame();
    } catch (err) {
      console.error('[game] transition failed:', err);
    } finally {
      transitioning = false;
    }
  }

  // Diagnostic snapshot (save + event log + device info) downloaded for bug reports.
  // Triggered by the hidden '?' key during play; a menu entry is the eventual home.
  function generateSupportBundle() {
    if (!level || !player) return;
    const bundle = buildSupportBundle({
      registry,
      level,
      player,
      turnCount: turnManager?.playerTurnCount ?? 0,
      ...levelManager.snapshot(),
    });
    downloadSupportBundle(bundle);
    console.log('[game] Support bundle generated');
  }

  function handleInput(event) {
    if (!level || !inputController) return false;

    // Once dead, the popup intercepts everything until "Next" is pressed.
    if (outcomePopup.isVisible) return outcomePopup.handleInput(event);

    // The contextual tile menu is modal while open — it swallows input and dismisses on tap-outside.
    if (contextMenu) return contextMenu.handleInput(event);

    // Targeting mode is modal over the map: taps pick a target (handled in onPointerUp), drags still
    // pan, the crosshair tracks the pointer, and Escape cancels. Everything else is swallowed.
    if (targeting) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        cancelTargeting();
        return true;
      }
      if (event.type === 'pointermove') {
        const w = renderer.screenToWorld(event.x, event.y);
        targeting.hoverTile = { x: Math.floor(w.x), y: Math.floor(w.y) };
        onPointerMove(event); // keep drag-to-pan available while aiming
        return true;
      }
      if (event.type === 'pointerdown') return onPointerDown(event);
      if (event.type === 'pointerup' || event.type === 'pointercancel') return onPointerUp(event);
      if (event.type === 'wheel') return onWheel(event.deltaY);
      return true;
    }

    if (characterMenuController.isOpen) {
      return characterMenuController.handleInput(event);
    }
    if (gameMenuController.isOpen) {
      return gameMenuController.handleInput(event);
    }

    if (dialogController.handleInput(event)) return true;
    if (messageLogWidget.handleInput(event)) return true;
    if (hudWidget.handleInput(event)) return true;
    if (characterMenuButton.handleInput(event)) return true;
    if (gameMenuButton.handleInput(event)) return true;

    // Desktop secondary click raises the same contextual menu as a touch long-press.
    if (event.type === 'contextmenu') {
      openContextMenu(event.x, event.y);
      return true;
    }

    if (event.type === 'pointerdown') return onPointerDown(event);
    if (event.type === 'pointermove') return onPointerMove(event);
    if (event.type === 'pointerup' || event.type === 'pointercancel') return onPointerUp(event);
    if (event.type === 'wheel') return onWheel(event.deltaY);

    // Hidden diagnostic export. '?' (Shift-/) is obscure enough to avoid accidental presses.
    if (event.type === 'keydown' && event.key === '?') {
      generateSupportBundle();
      return true;
    }

    if (event.type === 'keydown' && event.key === 'Escape') {
      inputController.submit({ type: 'cancel' });
      return true;
    }

    return false;
  }

  return {
    async enter() {
      try {
        // Fresh log and animation state per run. The event log isn't persisted, so a
        // continued game starts with an empty log too.
        gameLog.reset();
        animations.reset();
        vignette.reset();

        // On 'continue', rehydrate the saved game. A present-but-unloadable save (too-new, failed
        // migration, corrupt) is reported to the host (onLoadFailed) so the menu can explain it,
        // rather than silently discarding the run into a fresh game; we abort this mount and let the
        // transition take over. loadSavedGame returns null only when there is genuinely no save.
        let restored = null;
        if (startMode === 'continue') {
          try {
            restored = loadSavedGame();
          } catch (err) {
            console.error('[game] Failed to load save:', err);
            onLoadFailed?.(err);
            return;
          }
        }

        let initialTurnCount = 0;
        let enterMessage;
        if (restored) {
          await renderer.load();
          registry = restored.registry;
          level = restored.level;
          player = restored.player;
          initialTurnCount = restored.turnCount;
          // The dungeon runtime re-takes ownership of the active floor and the frozen floors.
          levelManager = createLevelManager({ registry, transitMap });
          levelManager.restore({
            currentNodeId: restored.currentNodeId,
            level: restored.level,
            frozenLevels: restored.frozenLevels,
          });
          enterMessage = 'You return to the dungeon.';
        } else {
          // Fresh master seed per run (gameConfig.seed null → random); recorded by the save so
          // the run is reproducible from it. Loaded games restore their own seed instead.
          rng.init(gameConfig.seed ?? undefined);
          // The level manager drives the transit map: it generates the start floor (drawing from its
          // own derived mapgen stream, independent of gameplay — rng-and-determinism.md) and reports
          // the arrival port.
          levelManager = createLevelManager({ registry, transitMap });
          const [{ level: startLevel, arrivalPort }] = await Promise.all([
            levelManager.start(),
            renderer.load(),
          ]);
          level = startLevel;
          // The player is created here (not by the pipeline); place it at the arrival point.
          const spawn = resolveArrival(registry, level, arrivalPort);
          player = await createPlayer(registry, spawn.x, spawn.y);
          level.placeEntity(player);
          enterMessage = 'You enter the dungeon.';
        }

        mountLevel({ initialTurnCount });

        // Mobile kills backgrounded pages without warning — catch the gap between turns.
        visibilityHandler = () => {
          if (document.visibilityState === 'hidden') saveGame();
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        gameLog.add({ display: enterMessage });

        console.log('[game] Level ready:', level.width, 'x', level.height);
      } catch (err) {
        console.error('[game] Failed to load level:', err);
      }
    },

    render(ctx) {
      if (!level) return;

      // Advance the animation clock once per frame before anything samples it, so the
      // camera and every sprite share a single consistent timestamp this frame.
      animations.frame();

      if (player && cameraMode === 'follow') {
        // Follow the player's *visual* position so the viewport tracks the sliding
        // sprite instead of snapping to the already-updated logical tile. In 'free'
        // (drag-to-pan) mode the camera holds wherever the player panned it.
        const { x, y } = animations.visualPos(player);
        renderer.setCamera(x, y);
      }

      const { width, height } = getViewport();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);

      const tilePerception = player?.components.get('tilePerception');
      renderer.drawMap(ctx, level, tilePerception);
      renderer.drawRememberedEntities(ctx, tilePerception);
      renderer.drawEntities(ctx, level, tilePerception);
      renderer.drawAnimations(ctx, tilePerception);

      const hp = player ? getPool(player, 'hp') : { current: 0, max: 0 };
      const mp = player ? getPool(player, 'mp') : { current: 0, max: 0 };
      const exp = player
        ? levelProgress(getAccumulator(player, 'xp'))
        : { level: 1, into: 0, forNext: 0 };
      const hunger = player ? hungerStatus(player) : 'ok';
      hudWidget.render(ctx, { level: exp.level, hp, mp, exp, hunger });
      // Hold a thin red edge vignette while starving — a peripheral cue you can't miss, backing the HUD
      // warning so a creeping starvation registers even mid-menu. Cleared the moment hunger recovers.
      vignette.setSustained('starving', hunger === 'starving' ? STARVING_VIGNETTE : null);

      characterMenuButton.render(ctx);
      gameMenuButton.render(ctx);
      // Rendered after the menu buttons so the open log overlay covers them.
      messageLogWidget.render(ctx);
      dialogController.render(ctx);
      characterMenuController.render(ctx);
      gameMenuController.render(ctx);
      contextMenu?.render(ctx);
      renderTargeting(ctx);
      outcomePopup.render(ctx);

      // Screen-edge vignettes draw last so they sit above the world *and* the UI — a damage warning
      // must read even with a menu open. Edge-only (clear center), so it never masks menu content.
      vignette.render(ctx, width, height);
    },

    screenToWorld(x, y) {
      return renderer.screenToWorld(x, y);
    },

    getDebugInfo(tx, ty) {
      if (!level) return { x: tx, y: ty };
      const tileId = level.getTile(tx, ty);
      if (!tileId) return { x: tx, y: ty };
      const tile = getTileType(tileId);
      const entities = [...level.getEntitiesAt(tx, ty)];
      return {
        x: tx,
        y: ty,
        tileName: tile.name,
        // Per-entity so the goal inspector can attribute each stack to its owner.
        entities: entities
          .filter((e) => e.components.get('name'))
          .map((e) => {
            const ai = e.components.get('ai');
            return {
              name: e.components.get('name'),
              goals: ai?.goals ?? null,
              activeGoal: ai?.lastGoal ?? null,
            };
          }),
        passable: level.isPassable(tx, ty),
        opaque: tile.opaque || entities.some((e) => e.components.has('opaque')),
      };
    },

    // Viewport-wide data for the debug overlay's world-space layers (FOV, passability, scent, sound).
    getDebugFrame() {
      if (!level) return null;
      const tp = player?.components.get('tilePerception');
      return {
        worldToScreen: renderer.worldToScreen,
        tileSize: renderer.tileSize,
        bounds: renderer.getVisibleTileRange(level),
        isPassable: (x, y) => level.isPassable(x, y),
        isVisible: (x, y) => !tp || tp.visible.has(tileKey(x, y)),
        isRemembered: (x, y) => tp?.memory.has(tileKey(x, y)) ?? false,
        // Non-zero scent at a tile, per profile (for the heatmap layer).
        getScent: (x, y) => {
          if (!level.scent) return [];
          const cells = [];
          for (const profile of level.scent.keys()) {
            const intensity = scentAt(level, profile, x, y);
            if (intensity > 0) cells.push({ profile, intensity });
          }
          return cells;
        },
        // The invisible live sound entities (for the sound layer).
        getSounds: () =>
          registry.getEntitiesWith('sound').map((e) => {
            const pos = e.components.get('position');
            return { x: pos.x, y: pos.y, volume: e.components.get('sound').volume };
          }),
      };
    },

    handleInput,

    exit() {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      turnManager?.stop();
      turnManager = null;
      inputController = null;
      contextMenu = null;
      targeting = null;
      resetGestures();
      levelManager = null;
      transitioning = false;
      level = null;
      player = null;
      animations.reset();
      vignette.reset();
    },
  };
}
