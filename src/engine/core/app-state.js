/**
 * @file Manages top-level scene transitions. Each state maps to a scene factory; on
 * transition the current scene stack is torn down and the new scene is pushed.
 */

import { LayerStack } from '../../render/layers.js';

export const AppState = Object.freeze({
  SPLASH: 'splash',
  MENU: 'menu',
  INSTRUCTIONS: 'instructions',
  GAME: 'game',
  RESULTS: 'results',
});

/**
 * Creates the top-level scene state machine. Register a scene factory per `AppState`;
 * each `transition` tears down the live layer stack (calling `exit` on each layer) and
 * pushes a freshly built scene.
 */
export function createAppStateMachine() {
  const scenes = new Map();
  const layers = new LayerStack();
  let currentState = null;

  function clearLayers() {
    while (layers.top()) {
      const layer = layers.pop();
      layer.exit?.();
    }
  }

  return {
    register(state, sceneFactory) {
      scenes.set(state, sceneFactory);
    },
    transition(state) {
      const factory = scenes.get(state);
      if (!factory) throw new Error(`No scene registered for state: ${String(state)}`);
      clearLayers();
      currentState = state;
      const scene = factory();
      layers.push(scene);
      scene.enter?.();
    },
    render(ctx) {
      layers.render(ctx);
    },
    handleInput(event) {
      return layers.handleInput(event);
    },
    get state() {
      return currentState;
    },
    get layers() {
      return layers;
    },
  };
}
