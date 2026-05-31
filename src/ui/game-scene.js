import { runPipeline } from '../world/generation/pipeline.js';
import staticTestLevel from '../../data/pipelines/static-test-level.js';
import { rng } from '../engine/rng.js';
import { createRenderer } from '../render/renderer.js';

export function createGameScene({ getViewport }) {
  let level = null;
  const renderer = createRenderer({ getViewport });

  return {
    enter() {
      Promise.all([
        runPipeline(staticTestLevel, rng),
        renderer.load(),
      ]).then(([loaded]) => {
        level = loaded;
        renderer.setCamera(level.width / 2, level.height / 2);
        console.log('[game] Level ready:', level.width, 'x', level.height);
      }).catch((err) => {
        console.error('[game] Failed to load level:', err);
      });
    },

    render(ctx) {
      if (!level) return;
      const { width, height } = getViewport();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);
      renderer.drawMap(ctx, level);
    },

    screenToWorld(x, y) {
      return renderer.screenToWorld(x, y);
    },

    handleInput(_event) { return false; },

    exit() { level = null; },
  };
}
