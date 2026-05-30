import { runPipeline } from '../world/generation/pipeline.js';
import staticTestLevel from '../../data/pipelines/static-test-level.js';
import { rng } from '../engine/rng.js';

export function createGameScene() {
  let level = null;

  return {
    enter() {
      runPipeline(staticTestLevel, rng).then((loaded) => {
        level = loaded;
        console.log('[game] Level loaded:', level);
      });
    },

    render(_ctx) {
      // rendering deferred — level exists in memory once loading completes
    },

    handleInput(_event) {
      return false;
    },

    exit() {
      level = null;
    },
  };
}
