import { components } from './components.js';
import { HUMANOID_SLOTS } from '../../data/equipment-slots.js';

// Creates and returns the player entity. Async so that a character creation
// UI can be introduced here later without changing the call site in game-scene.
export async function createPlayer(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Player'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(20, 20));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  registry.addComponent(entity, 'playerControlled', components.playerControlled());
  registry.addComponent(entity, 'attacker', components.attacker(1));
  registry.addComponent(entity, 'faction', components.faction(['player']));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses(['vision']));
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(entity, 'ai', components.ai(['player-auto-move', 'player-auto-pickup', 'player-get-input']));
  registry.addComponent(entity, 'renderable', components.renderable(null, '#0a1a0a', '@', '#00cc44'));
  return entity;
}
