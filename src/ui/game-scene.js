import { runPipeline } from '../world/generation/pipeline.js';
import staticTestLevel from '../../data/pipelines/static-test-level.js';
import { rng } from '../engine/rng.js';
import { createRenderer } from '../render/renderer.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createTurnManager } from '../engine/turn-manager.js';
import { createInputController } from '../engine/input-controller.js';
import { createActionSystem } from '../actions/action-system.js';
import { createPlayer } from '../world/player.js';

export function createGameScene({ getViewport }) {
  let level = null;
  let player = null;
  let turnManager = null;
  let inputController = null;

  const registry = createEntityRegistry();
  const renderer = createRenderer({ getViewport });

  function getPlayerPos() {
    return registry.getComponent(player, 'position');
  }

  function handleInput(event) {
    if (!level || !inputController?.isWaiting()) return false;

    if (event.type === 'pointerdown') {
      const world = renderer.screenToWorld(event.x, event.y);
      const tx = Math.floor(world.x);
      const ty = Math.floor(world.y);
      inputController.submit({ type: 'move', x: tx, y: ty });
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

        renderer.setCamera(cx, cy);

        inputController = createInputController();
        const actionSystem = createActionSystem({ level, inputController });
        turnManager = createTurnManager({
          getActiveEntities: () => registry.getEntitiesWith('turnTaker'),
          invokeAction: (entity) => actionSystem.invokeAction(entity),
        });
        turnManager.start();

        console.log('[game] Level ready:', level.width, 'x', level.height);
      } catch (err) {
        console.error('[game] Failed to load level:', err);
      }
    },

    render(ctx) {
      if (!level) return;

      // Camera must be updated before drawing so entities are positioned
      // relative to the current player position, not last frame's.
      if (player) {
        const pos = getPlayerPos();
        renderer.setCamera(pos.x, pos.y);
      }

      const { width, height } = getViewport();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);
      renderer.drawMap(ctx, level);
      renderer.drawEntities(ctx, level);
    },

    screenToWorld(x, y) {
      return renderer.screenToWorld(x, y);
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
