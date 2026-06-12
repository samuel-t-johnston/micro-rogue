import { runPipeline } from '../world/generation/pipeline.js';
import staticTestLevel from '../../data/pipelines/static-test-level.js';
import { rng } from '../engine/rng.js';
import { gameConfig } from '../engine/game-config.js';
import { createRenderer } from '../render/renderer.js';
import { animations } from '../render/animations.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createTurnManager } from '../engine/turn-manager.js';
import { createInputController } from '../engine/input-controller.js';
import { createActionSystem } from '../actions/action-system.js';
import { createPlayer } from '../world/player.js';
import { applySenses } from '../ai/planning-context.js';
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
import { createDeathPopup } from './death-popup.js';
import { commitSave, loadSavedGame, clearSave } from '../save/save-system.js';

export function createGameScene({ theme, getViewport, onGameOver, onNewGame, startMode = 'new' }) {
  let level = null;
  let player = null;
  let turnManager = null;
  let inputController = null;
  let gameOver = false;
  let visibilityHandler = null;

  let registry = createEntityRegistry();
  const renderer = createRenderer({ getViewport });
  const hudWidget = createHudWidget({ theme, getViewport });
  const messageLogWidget = createMessageLogWidget({ theme, getViewport });
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
  const deathPopup = createDeathPopup({
    theme,
    getViewport,
    onNext: () => {
      onGameOver?.({ turns: turnManager?.playerTurnCount ?? 0, player, level });
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
    commitSave({ registry, level, player, turnCount: turnManager?.playerTurnCount ?? 0 });
  }

  // Wired into the level by enter(); fired from the death chokepoint when the player's
  // HP hits 0. Deletes the save *before* the death screen (never persist a dead player),
  // freezes the turn loop, and surfaces the death popup over the frozen scene.
  function handlePlayerDeath() {
    if (gameOver) return;
    gameOver = true;
    turnManager?.stop();
    clearSave();
    deathPopup.show();
  }

  function handleInput(event) {
    if (!level || !inputController) return false;

    // Once dead, the popup intercepts everything until "Next" is pressed.
    if (deathPopup.isVisible) return deathPopup.handleInput(event);

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

    if (event.type === 'pointerdown') {
      const world = renderer.screenToWorld(event.x, event.y);
      const tx = Math.floor(world.x);
      const ty = Math.floor(world.y);
      inputController.submit({ type: 'move', x: tx, y: ty });
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
          enterMessage = 'You return to the dungeon.';
        } else {
          // Fresh seed per run (gameConfig.seed null → random); recorded by the save so the
          // run is reproducible from it. Loaded games restore their own seed instead.
          rng.init(gameConfig.seed ?? undefined);
          const [loaded] = await Promise.all([
            runPipeline(staticTestLevel, rng, registry),
            renderer.load(),
          ]);
          level = loaded;
          const cx = Math.floor(level.width / 2);
          const cy = Math.floor(level.height / 2);
          player = await createPlayer(registry, cx, cy);
          level.placeEntity(player);
          enterMessage = 'You enter the dungeon.';
        }

        level.onPlayerDeath = handlePlayerDeath;
        applySenses(player, level);

        const ppos = registry.getComponent(player, 'position');
        renderer.setCamera(ppos.x, ppos.y);

        inputController = createInputController();
        const actionSystem = createActionSystem({ level, inputController, registry, dialogController });
        turnManager = createTurnManager({
          getActiveEntities: () => registry.getEntitiesWith('turnTaker'),
          invokeAction: (entity) => actionSystem.invokeAction(entity),
          // Autosave at the player's turn-start, once the world has fully settled.
          onTurnStart: (entity) => { if (entity.components.has('playerControlled')) saveGame(); },
          initialTurnCount,
        });
        gameLog.setTurnProvider(() => turnManager?.playerTurnCount ?? 0);
        gameLog.setVisibilityProvider(isEntryVisibleToPlayer);
        turnManager.start();

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
      renderer.drawEntities(ctx, level, tilePerception);
      renderer.drawAnimations(ctx, tilePerception);

      const hp = player ? registry.getComponent(player, 'health') : { current: 0, max: 0 };
      hudWidget.render(ctx, { hp, turn: turnManager?.playerTurnCount ?? 0 });

      const recentLines = gameLog.getDisplayEntries(3).map(e => e.display);
      messageLogWidget.render(ctx, { recentLines });

      characterMenuButton.render(ctx);
      gameMenuButton.render(ctx);
      dialogController.render(ctx);
      characterMenuController.render(ctx);
      gameMenuController.render(ctx);
      deathPopup.render(ctx);
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

    // Viewport-wide data for the debug overlay's world-space layers (FOV, passability).
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
      level = null;
      player = null;
      animations.reset();
    },
  };
}
