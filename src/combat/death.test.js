import { describe, it, expect, beforeEach } from 'vitest';
import { handleDeath } from './death.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createLevel } from '../world/level.js';
import { components } from '../world/components.js';

describe('handleDeath', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = createLevel();
  });

  it('removes a dead NPC from the level and registry', () => {
    const npc = registry.createEntity();
    registry.addComponent(npc, 'position', components.position(2, 2));
    registry.addComponent(npc, 'turnTaker', components.turnTaker(1));
    level.placeEntity(npc);

    handleDeath(npc, level, registry);

    expect(registry.getEntity(npc.id)).toBeNull();
    expect(level.entities).not.toContain(npc);
    expect(level.getEntitiesAt(2, 2).has(npc)).toBe(false);
  });

  it('leaves the player in place and fires the level onPlayerDeath hook', () => {
    const player = registry.createEntity();
    registry.addComponent(player, 'position', components.position(1, 1));
    registry.addComponent(player, 'playerControlled', components.playerControlled());
    level.placeEntity(player);

    let signalled = null;
    level.onPlayerDeath = (entity) => {
      signalled = entity;
    };

    handleDeath(player, level, registry);

    expect(registry.getEntity(player.id)).toBe(player);
    expect(level.entities).toContain(player);
    expect(signalled).toBe(player);
  });

  it('does not throw on player death when no onPlayerDeath hook is set', () => {
    const player = registry.createEntity();
    registry.addComponent(player, 'position', components.position(1, 1));
    registry.addComponent(player, 'playerControlled', components.playerControlled());
    level.placeEntity(player);

    expect(() => handleDeath(player, level, registry)).not.toThrow();
    expect(level.entities).toContain(player);
  });
});
