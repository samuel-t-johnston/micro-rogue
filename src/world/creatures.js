import { components } from './components.js';
import { HUMANOID_SLOTS } from '../../data/equipment-slots.js';

// No sprites yet — goblins and orcs render as a colored glyph (green 'g', red 'o').

export function createGoblin(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Goblin'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(5, 5));
  registry.addComponent(entity, 'attacker', components.attacker(1));
  registry.addComponent(entity, 'faction', components.faction(['goblins']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses(['vision']));
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(entity, 'ai', components.ai(['attack-adjacent', 'flee-from-others', 'wander-aimlessly']));
  registry.addComponent(entity, 'renderable', components.renderable(null, '#0a1a0a', 'g', '#2ecc40'));
  return entity;
}

export function createOrc(registry, x, y) {
  const entity = registry.createEntity();
  registry.addComponent(entity, 'name', components.name('Orc'));
  registry.addComponent(entity, 'position', components.position(x, y));
  registry.addComponent(entity, 'health', components.health(9, 9));
  registry.addComponent(entity, 'attacker', components.attacker(1));
  registry.addComponent(entity, 'faction', components.faction(['orcs']));
  registry.addComponent(entity, 'turnTaker', components.turnTaker(1));
  registry.addComponent(entity, 'blocksMovement', components.blocksMovement());
  registry.addComponent(entity, 'inventory', components.inventory());
  registry.addComponent(entity, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));
  registry.addComponent(entity, 'memory', components.memory());
  registry.addComponent(entity, 'senses', components.senses(['vision']));
  registry.addComponent(entity, 'tilePerception', components.tilePerception());
  registry.addComponent(entity, 'ai', components.ai(['attack-adjacent', 'chase-others', 'wander-aimlessly']));
  registry.addComponent(entity, 'renderable', components.renderable(null, '#0a1a0a', 'o', '#e74c3c'));
  return entity;
}
