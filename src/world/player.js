import { components } from './components.js';
import { megaVision } from '../ai/senses/mega-vision.js';

// Creates and returns the player entity. Async so that a character creation
// UI can be introduced here later without changing the call site in game-scene.
export async function createPlayer(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(20, 20));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  registry.addComponent(entity, 'playerControlled', components.playerControlled());
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses([megaVision]));
  registry.addComponent(entity, 'renderable', {
    sprite: null,
    color: '#0a1a0a',
    glyph: '@',
    glyphColor: '#00cc44',
  });
  return entity;
}
