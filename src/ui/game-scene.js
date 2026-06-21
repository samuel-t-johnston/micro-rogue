import { rng } from '../engine/rng.js';
import { gameConfig } from '../engine/game-config.js';
import { createRenderer } from '../render/renderer.js';
import { createZoom, defaultZoomIndex } from '../render/zoom.js';
import { animations } from '../render/animations.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createTurnManager } from '../engine/turn-manager.js';
import { createInputController } from '../engine/input-controller.js';
import { createActionSystem } from '../actions/action-system.js';
import { createPlayer } from '../world/player.js';
import { resolveArrival } from '../world/spawn.js';
import { createLevelManager } from '../world/level-manager.js';
import transitMap from '../../data/transit-map.js';
import { applySenses } from '../ai/planning-context.js';
import { upkeep } from '../engine/upkeep.js';
import { winConditions, escapeWithQuestItem } from '../engine/win-conditions.js';
import { scentUpkeep, scentAt } from '../world/scent.js';
import { getTileType } from '../world/tile-registry.js';
import { gameLog } from '../engine/game-log.js';
import { isEntryVisible } from '../engine/log-visibility.js';
import { createHudWidget } from './widgets/hud.js';
import { createMessageLogWidget } from './widgets/message-log.js';
import { createCharacterMenuButton } from './widgets/character-menu-button.js';
import { createDialogController } from './dialog-controller.js';
import { createCharacterMenuController } from './character-menu-controller.js';
import { createGameMenuController } from './game-menu-controller.js';
import { createGameMenuButton } from './widgets/game-menu-button.js';
import { createOutcomePopup } from './outcome-popup.js';
import { createContextMenu } from './context-menu.js';
import { resolveTileActions } from '../actions/resolve-tile-actions.js';
import { commitSave, loadSavedGame, clearSave } from '../save/save-system.js';
import { buildSupportBundle, downloadSupportBundle } from '../save/support-bundle.js';

export function createGameScene({ theme, getViewport, onGameOver, onNewGame, startMode = 'new' }) {
  let level = null;
  let player = null;
  let levelManager = null;
  let turnManager = null;
  let inputController = null;
  let gameOver = false;
  let outcome = 'lose';      // 'lose' | 'win' — how the run ended, set by endGame()
  let outcomeMessage = '';   // optional detail line carried to the Results screen
  let transitioning = false;
  let visibilityHandler = null;

  let registry = createEntityRegistry();
  // Touch devices (coarse pointer) start zoomed closer; mouse/desktop start wider. Session-only.
  const coarsePointer = !!(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches);
  const zoom = createZoom({ index: defaultZoomIndex(coarsePointer) });
  const renderer = createRenderer({ getViewport, zoom });

  // Map-area gesture state (release-based tap-to-move + pinch-to-zoom). UI taps never reach
  // here — they're consumed by the widget chain in handleInput before a gesture can start.
  const pointers = new Map(); // active map-area pointers: id -> { x, y }
  let tapCandidate = null;    // a single press that may become a move on release
  let pinch = null;           // { baseDist } — two-finger zoom, ratcheted per step
  const TAP_SLOP = 12;        // px of drift that disqualifies a tap (and is the future pan hook)
  const PINCH_STEP_RATIO = 1.25; // pinch distance change that advances one zoom level
  const LONGPRESS_MS = 450;   // press-and-hold that raises the contextual tile menu (touch)
  let longPressTimer = null;
  let contextMenu = null;     // the open contextual tile menu (modal popover), or null

  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  function resetGestures() {
    pointers.clear();
    tapCandidate = null;
    pinch = null;
    clearLongPress();
  }

  // Raise the contextual menu for the tile under a screen point (long-press or right-click). Builds
  // its rows from the same resolveTileActions the tap interpreter uses, so the offered actions match
  // what a tap would do. A tile with nothing to offer opens no menu. Hands gesture state to the modal.
  function openContextMenu(screenX, screenY) {
    if (!level || !inputController) return;
    const world = renderer.screenToWorld(screenX, screenY);
    const tile = { x: Math.floor(world.x), y: Math.floor(world.y) };
    const rows = resolveTileActions(level, getPlayerPos(), tile);
    if (rows.length === 0) return;
    resetGestures();
    contextMenu = createContextMenu({
      theme, getViewport,
      anchor: { x: screenX, y: screenY },
      rows,
      onSelect: (action) => {
        contextMenu = null;
        if (action) inputController.submit(action);
      },
    });
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
      // Hold this press still long enough and it becomes a contextual menu instead of a move.
      const { x, y, pointerId } = event;
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (tapCandidate?.id === pointerId) openContextMenu(x, y); // resetGestures() clears tapCandidate
      }, LONGPRESS_MS);
    } else if (pointers.size === 2) {
      tapCandidate = null;
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
      if (dist >= pinch.baseDist * PINCH_STEP_RATIO) { renderer.zoomIn(); pinch.baseDist = dist; }
      else if (dist <= pinch.baseDist / PINCH_STEP_RATIO) { renderer.zoomOut(); pinch.baseDist = dist; }
    } else if (tapCandidate?.id === event.pointerId &&
               Math.hypot(event.x - tapCandidate.x, event.y - tapCandidate.y) > TAP_SLOP) {
      tapCandidate = null; // dragged too far to be a tap (drag-to-pan will attach here later)
      clearLongPress();    // …and too far to be a long-press
    }
    return true;
  }

  // Release: a still-valid single-finger tap becomes the move action at the released tile.
  function onPointerUp(event) {
    const releasingTap = tapCandidate?.id === event.pointerId;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    clearLongPress(); // released (or cancelled) before the hold elapsed — no menu
    if (releasingTap) {
      tapCandidate = null;
      const world = renderer.screenToWorld(event.x, event.y);
      // A raw tile tap; the player-get-input goal interprets it (move / attack / interact / pick up).
      inputController.submit({ type: 'tap', x: Math.floor(world.x), y: Math.floor(world.y) });
    }
    return true;
  }

  // Wheel up zooms in (closer), wheel down zooms out (wider).
  function onWheel(deltaY) {
    if (deltaY < 0) renderer.zoomIn();
    else if (deltaY > 0) renderer.zoomOut();
    return true;
  }
  const hudWidget = createHudWidget({ theme, getViewport });
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
    onAction: (action) => inputController?.submit(action),
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
      onGameOver?.({ outcome, message: outcomeMessage, turns: turnManager?.playerTurnCount ?? 0, player, level });
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
      registry, level, player,
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

    const ppos = registry.getComponent(player, 'position');
    renderer.setCamera(ppos.x, ppos.y);

    inputController = createInputController();
    resetGestures();
    const actionSystem = createActionSystem({ level, inputController, registry, dialogController });

    // Per-player-turn upkeep (see src/engine/upkeep.js). Order matters: scent diffuses before the
    // autosave so a reload restores the up-to-date field. Steps read the current level from context.
    upkeep.register('scent', (ctx) => scentUpkeep(ctx.level, ctx.registry));
    upkeep.register('autosave', () => saveGame());

    // The classic victory: escape the dungeon (stand on a dungeonExit) carrying the Amulet of Yendor.
    // Registered here so the win check is live for every floor; evaluated at each player turn-end.
    winConditions.register('escape-with-amulet', escapeWithQuestItem(
      'amulet-of-yendor',
      'You escaped the dungeon with the Amulet of Yendor!',
    ));

    turnManager = createTurnManager({
      // Turn-queue membership = takes turns OR decays. turnTakers act on the energy model;
      // decay entities (sounds, etc.) ride the same queue purely to age out once per round.
      getActiveEntities: () => {
        const members = new Set(registry.getEntitiesWith('turnTaker'));
        for (const e of registry.getEntitiesWith('decay')) members.add(e);
        return [...members];
      },
      invokeAction: (entity) => actionSystem.invokeAction(entity),
      onTurnStart: (entity) => { if (entity.components.has('playerControlled')) upkeep.run({ level, registry, player }); },
      onTurnEnd: handleTurnEnd,
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
        gameLog.add({ display: port === 'down' ? 'You descend deeper into the dungeon.' : 'You climb the stairs.' });
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
      registry, level, player,
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

    if (characterMenuController.isOpen) {
      return characterMenuController.handleInput(event);
    }
    if (gameMenuController.isOpen) {
      return gameMenuController.handleInput(event);
    }

    if (dialogController.handleInput(event)) return true;
    if (messageLogWidget.handleInput(event)) return true;
    if (characterMenuButton.handleInput(event)) return true;
    if (gameMenuButton.handleInput(event)) return true;

    // Desktop secondary click raises the same contextual menu as a touch long-press.
    if (event.type === 'contextmenu') { openContextMenu(event.x, event.y); return true; }

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

        // On 'continue', try to rehydrate the saved game; any failure (no save, too-new,
        // migration error) falls through to a fresh game rather than dead-ending.
        let restored = null;
        if (startMode === 'continue') {
          try {
            restored = loadSavedGame();
          } catch (err) {
            console.error('[game] Failed to load save; starting a new game:', err);
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
        visibilityHandler = () => { if (document.visibilityState === 'hidden') saveGame(); };
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

      if (player) {
        // Follow the player's *visual* position so the viewport tracks the sliding
        // sprite instead of snapping to the already-updated logical tile.
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

      const hp = player ? registry.getComponent(player, 'health') : { current: 0, max: 0 };
      hudWidget.render(ctx, { hp, turn: turnManager?.playerTurnCount ?? 0 });

      characterMenuButton.render(ctx);
      gameMenuButton.render(ctx);
      // Rendered after the menu buttons so the open log overlay covers them.
      messageLogWidget.render(ctx);
      dialogController.render(ctx);
      characterMenuController.render(ctx);
      gameMenuController.render(ctx);
      contextMenu?.render(ctx);
      outcomePopup.render(ctx);
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
          .filter(e => e.components.get('name'))
          .map(e => {
            const ai = e.components.get('ai');
            return {
              name: e.components.get('name'),
              goals: ai?.goals ?? null,
              activeGoal: ai?.lastGoal ?? null,
            };
          }),
        passable: level.isPassable(tx, ty),
        opaque: tile.opaque || entities.some(e => e.components.has('opaque')),
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
        isVisible: (x, y) => !tp || tp.visible.has(`${x},${y}`),
        isRemembered: (x, y) => tp?.memory.has(`${x},${y}`) ?? false,
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
        getSounds: () => registry.getEntitiesWith('sound').map(e => {
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
      resetGestures();
      levelManager = null;
      transitioning = false;
      level = null;
      player = null;
      animations.reset();
    },
  };
}
