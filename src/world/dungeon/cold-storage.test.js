import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../level.js';
import { components } from '../components.js';
import { collectSubgraph } from './subgraph.js';
import { freezeLevel, thawLevel } from './cold-storage.js';

// A small level: a monster on the map, and a chest holding one item. Optionally a "player" entity
// (a positioned entity carrying an inventory item) so exclusion can be exercised.
function buildLevel({ withPlayer = false } = {}) {
  const registry = createEntityRegistry();
  const level = createLevel({ branch: 0, depth: 1, pipelineId: 'random-static-maze', seed: 555 });
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  level.blackboard = { theme: 'maze' };

  const monster = registry.createEntity();
  registry.addComponent(monster, 'name', components.name('Goblin'));
  registry.addComponent(monster, 'position', components.position(2, 2));
  level.placeEntity(monster);

  const chest = registry.createEntity();
  registry.addComponent(chest, 'position', components.position(3, 1));
  registry.addComponent(chest, 'container', components.container());
  registry.addComponent(chest, 'inventory', components.inventory());
  const gold = registry.createEntity();
  registry.addComponent(gold, 'name', components.name('Gold'));
  chest.components.get('inventory').items.push(gold);
  level.placeEntity(chest);

  let player = null;
  if (withPlayer) {
    player = registry.createEntity();
    registry.addComponent(player, 'name', components.name('Player'));
    registry.addComponent(player, 'position', components.position(1, 1));
    registry.addComponent(player, 'inventory', components.inventory());
    const sword = registry.createEntity();
    registry.addComponent(sword, 'name', components.name('Sword'));
    player.components.get('inventory').items.push(sword);
    level.placeEntity(player);
  }

  return { registry, level, monster, chest, gold, player };
}

describe('freezeLevel / thawLevel round-trip', () => {
  it('restores tiles, identity, blackboard, on-map entities, and container contents', () => {
    const { registry, level } = buildLevel();
    const blob = freezeLevel(registry, level);

    // Survives JSON — the blob is a real save fragment.
    const reg2 = createEntityRegistry();
    const level2 = thawLevel(JSON.parse(JSON.stringify(blob)), reg2);

    expect(level2.getTile(0, 0)).toBe('floor');
    expect(level2.blackboard).toEqual({ theme: 'maze' });
    expect(level2).toMatchObject({ branch: 0, depth: 1, pipelineId: 'random-static-maze', seed: 555 });

    const monster2 = [...level2.getEntitiesAt(2, 2)][0];
    expect(monster2.components.get('name')).toBe('Goblin');

    const chest2 = [...level2.getEntitiesAt(3, 1)][0];
    const contents = chest2.components.get('inventory').items;
    expect(contents).toHaveLength(1);
    expect(contents[0].components.get('name')).toBe('Gold');
  });
});

describe('freezeLevel exclusion (limbo)', () => {
  it('omits the excluded sub-graph from the blob and leaves it in the registry', () => {
    const { registry, level, player, monster } = buildLevel({ withPlayer: true });
    const excludeIds = new Set([...collectSubgraph([player])].map(e => e.id));
    const carriedId = player.components.get('inventory').items[0].id;

    const blob = freezeLevel(registry, level, excludeIds);

    // Player + carried item are not in the frozen blob...
    const frozenIds = blob.entities.map(e => e.id);
    expect(frozenIds).not.toContain(player.id);
    expect(frozenIds).not.toContain(carriedId);
    // ...nor referenced by the frozen level...
    expect(blob.level.entityIds).not.toContain(player.id);
    // ...but they survive in the live registry (they travel with the player).
    expect(registry.getEntity(player.id)).not.toBeNull();
    expect(registry.getEntity(carriedId)).not.toBeNull();

    // The level's own entities (monster, chest, gold) are frozen and removed from the registry.
    expect(frozenIds).toContain(monster.id);
    expect(registry.getEntity(monster.id)).toBeNull();
  });

  it('keeps nextId monotonic so thawing never collides with live ids', () => {
    const { registry, level, player } = buildLevel({ withPlayer: true });
    const excludeIds = new Set([...collectSubgraph([player])].map(e => e.id));
    const nextIdBefore = registry.getNextId();

    const blob = freezeLevel(registry, level, excludeIds);
    // The live registry's id counter never rewinds when entities leave it.
    expect(registry.getNextId()).toBe(nextIdBefore);

    // Thawing into the same registry re-registers the frozen ids without exceeding the counter.
    thawLevel(blob, registry);
    const maxId = Math.max(...registry.getAllEntities().map(e => e.id));
    expect(registry.getNextId()).toBeGreaterThan(maxId);
  });
});
