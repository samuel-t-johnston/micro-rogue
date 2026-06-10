import { runPipeline } from '../world/generation/pipeline.js';
import staticTestLevel from '../../data/pipelines/static-test-level.js';
import { rng } from '../engine/rng.js';
import { createRenderer } from '../render/renderer.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createTurnManager } from '../engine/turn-manager.js';
import { createInputController } from '../engine/input-controller.js';
import { createActionSystem } from '../actions/action-system.js';
import { createPlayer } from '../world/player.js';
import { applySenses } from '../ai/planning-context.js';
import { getTileType } from '../world/tile-registry.js';
import { gameLog } from '../engine/game-log.js';
import { createHudWidget } from './widgets/hud.js';
import { createMessageLogWidget } from './widgets/message-log.js';
import { createCharacterMenuButton } from './widgets/character-menu-button.js';
import { createDialogController } from './dialog-controller.js';
import { createCharacterMenuController } from './character-menu-controller.js';
import { createDeathPopup } from './death-popup.js';

export function createGameScene({ theme, getViewport, onGameOver }) {
  let level = null;
  let player = null;
  let turnManager = null;
  let inputController = null;
  let gameOver = false;

  const registry = createEntityRegistry();
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

  // Wired into the level by enter(); fired from the death chokepoint when the player's
  // HP hits 0. Freezes the turn loop and surfaces the death popup over the frozen scene.
  function handlePlayerDeath() {
    if (gameOver) return;
    gameOver = true;
    turnManager?.stop();
    deathPopup.show();
  }

  function handleInput(event) {
    if (!level || !inputController) return false;

    // Once dead, the popup intercepts everything until "Next" is pressed.
    if (deathPopup.isVisible) return deathPopup.handleInput(event);

    if (characterMenuController.isOpen) {
      return characterMenuController.handleInput(event);
    }

    if (dialogController.handleInput(event)) return true;
    if (messageLogWidget.handleInput(event)) return true;
    if (characterMenuButton.handleInput(event)) return true;

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
        // Fresh log per run; stamp entries with the live player-turn count.
        gameLog.reset();

        const [loaded] = await Promise.all([
          runPipeline(staticTestLevel, rng, registry),
          renderer.load(),
        ]);
        level = loaded;
        level.onPlayerDeath = handlePlayerDeath;

        const cx = Math.floor(level.width / 2);
        const cy = Math.floor(level.height / 2);
        player = await createPlayer(registry, cx, cy);
        level.placeEntity(player);
        applySenses(player, level);

        renderer.setCamera(cx, cy);

        inputController = createInputController();
        const actionSystem = createActionSystem({ level, inputController, registry, dialogController });
        turnManager = createTurnManager({
          getActiveEntities: () => registry.getEntitiesWith('turnTaker'),
          invokeAction: (entity) => actionSystem.invokeAction(entity),
        });
        gameLog.setTurnProvider(() => turnManager?.playerTurnCount ?? 0);
        turnManager.start();

        gameLog.add({ display: 'You enter the dungeon.' });

        console.log('[game] Level ready:', level.width, 'x', level.height);
      } catch (err) {
        console.error('[game] Failed to load level:', err);
      }
    },

    render(ctx) {
      if (!level) return;

      if (player) {
        const pos = getPlayerPos();
        renderer.setCamera(pos.x, pos.y);
      }

      const { width, height } = getViewport();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);
      
      const tilePerception = player?.components.get('tilePerception');
      renderer.drawMap(ctx, level, tilePerception);
      renderer.drawEntities(ctx, level, tilePerception);

      const hp = player ? registry.getComponent(player, 'health') : { current: 0, max: 0 };
      hudWidget.render(ctx, { hp, turn: turnManager?.playerTurnCount ?? 0 });

      const recentLines = gameLog.getDisplayEntries(2).map(e => e.display);
      messageLogWidget.render(ctx, { recentLines });

      characterMenuButton.render(ctx);
      dialogController.render(ctx);
      characterMenuController.render(ctx);
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
        entityNames: entities.map(e => e.components.get('name')).filter(Boolean),
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
      turnManager?.stop();
      turnManager = null;
      inputController = null;
      level = null;
      player = null;
    },
  };
}
