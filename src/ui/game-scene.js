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
import { createEventLog } from '../engine/event-log.js';
import { createHudWidget } from './widgets/hud.js';
import { createMessageLogWidget } from './widgets/message-log.js';

export function createGameScene({ theme, getViewport }) {
  let level = null;
  let player = null;
  let turnManager = null;
  let inputController = null;

  const registry = createEntityRegistry();
  const renderer = createRenderer({ getViewport });
  const eventLog = createEventLog();
  const hudWidget = createHudWidget({ theme, getViewport });
  const messageLogWidget = createMessageLogWidget({ theme, getViewport });

  function getPlayerPos() {
    return registry.getComponent(player, 'position');
  }

  function handleInput(event) {
    if (!level || !inputController) return false;

    if (messageLogWidget.handleInput(event)) return true;

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
        const [loaded] = await Promise.all([
          runPipeline(staticTestLevel, rng, registry),
          renderer.load(),
        ]);
        level = loaded;

        const cx = Math.floor(level.width / 2);
        const cy = Math.floor(level.height / 2);
        player = await createPlayer(registry, cx, cy);
        level.placeEntity(player);
        applySenses(player, level);

        renderer.setCamera(cx, cy);

        inputController = createInputController();
        const actionSystem = createActionSystem({ level, inputController, registry });
        turnManager = createTurnManager({
          getActiveEntities: () => registry.getEntitiesWith('turnTaker'),
          invokeAction: (entity) => actionSystem.invokeAction(entity),
        });
        turnManager.start();

        eventLog.add({ turn: 0, display: 'You enter the dungeon.' });

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

      const recentLines = eventLog.getDisplayEntries(2).map(e => e.display);
      messageLogWidget.render(ctx, { recentLines });
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
