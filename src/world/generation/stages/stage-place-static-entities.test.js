import { describe, it, expect } from 'vitest';
import { run as runPlace } from './stage-place-static-entities.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { resolveSpawn } from '../../map/spawn.js';

function place(entities) {
  const level = createLevel();
  level.width = 15;
  level.height = 15;
  const registry = createEntityRegistry();
  level.blackboard['static:entities'] = entities;
  runPlace(level, {}, level.blackboard, null, registry);
  return { level, registry };
}

const at = (level, x, y) => [...level.getEntitiesAt(x, y)];

describe('placeStaticEntities stage', () => {
  it('places up-stairs as the entry point so resolveSpawn finds it', () => {
    const { level, registry } = place([{ type: 'stairsUp', x: 1, y: 1 }]);
    const stairs = at(level, 1, 1)[0];
    expect(stairs.components.get('name')).toBe('Stairs Up');
    expect(stairs.components.has('entryPoint')).toBe(true);
    expect(stairs.components.has('transition')).toBe(true);
    expect(resolveSpawn(registry, level)).toEqual({ x: 1, y: 1 });
  });

  it('places creatures and items at their authored tiles', () => {
    const { level } = place([
      { type: 'orc', x: 4, y: 4 },
      { type: 'healingPotion', x: 5, y: 5 },
    ]);
    expect(at(level, 4, 4)[0].components.get('name')).toBe('Orc');
    expect(at(level, 5, 5)[0].components.get('name')).toBe('Healing Potion');
  });

  it('fills a chest with its authored contents', () => {
    const { level } = place([{ type: 'chest', x: 7, y: 7, contents: ['sword', 'leatherArmor'] }]);
    const chest = at(level, 7, 7)[0];
    expect(chest.components.has('container')).toBe(true);
    const items = chest.components.get('inventory').items;
    expect(items.map((i) => i.components.get('name'))).toEqual(['Sword', 'Leather Armor']);
  });

  it('throws on an unknown entity type', () => {
    expect(() => place([{ type: 'dragon', x: 1, y: 1 }])).toThrow(/dragon/);
  });
});
