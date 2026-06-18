import { describe, it, expect } from 'vitest';
import { megaVision } from './mega-vision.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { components } from '../../world/components.js';

// Minimal level stand-in: mega-vision only reads `level.entities`.
function levelOf(...entities) {
  return { entities };
}

function observed(result, entityId) {
  return result.entities.find(o => o.entityId === entityId);
}

describe('megaVision isActor / isPlayer tags', () => {
  const registry = createEntityRegistry();

  function make(buildComponents) {
    const e = registry.createEntity();
    buildComponents(e);
    return e;
  }

  const observer = make(e => registry.addComponent(e, 'position', components.position(0, 0)));

  it('tags an entity with a creature component as an actor', () => {
    const monster = make(e => {
      registry.addComponent(e, 'position', components.position(1, 1));
      registry.addComponent(e, 'creature', components.creature());
    });
    const result = megaVision(observer, levelOf(observer, monster), 0);
    expect(observed(result, monster.id).tags.isActor).toBe(true);
  });

  it('does not tag a non-creature (e.g. a floor item) as an actor', () => {
    const item = make(e => {
      registry.addComponent(e, 'position', components.position(2, 2));
      registry.addComponent(e, 'item', components.item({ type: 'map' }));
    });
    const result = megaVision(observer, levelOf(observer, item), 0);
    expect(observed(result, item.id).tags.isActor).toBe(false);
  });

  it('does not treat a turnTaker without a creature component as an actor', () => {
    // turnTaker is about action order, not identity — a non-creature timed object can take
    // turns without being a creature. Decoupled so senses report only true creatures as actors.
    const timedObject = make(e => {
      registry.addComponent(e, 'position', components.position(3, 3));
      registry.addComponent(e, 'turnTaker', components.turnTaker(1));
    });
    const result = megaVision(observer, levelOf(observer, timedObject), 0);
    expect(observed(result, timedObject.id).tags.isActor).toBe(false);
  });

  it('tags the player-controlled entity as the player', () => {
    const player = make(e => {
      registry.addComponent(e, 'position', components.position(4, 4));
      registry.addComponent(e, 'creature', components.creature());
      registry.addComponent(e, 'playerControlled', components.playerControlled());
    });
    const result = megaVision(observer, levelOf(observer, player), 0);
    expect(observed(result, player.id).tags.isPlayer).toBe(true);
  });
});
