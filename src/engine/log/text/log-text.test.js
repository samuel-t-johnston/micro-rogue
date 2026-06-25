import { describe, it, expect } from 'vitest';
import { isPlayer, subject, object, conjugate, itemName } from './log-text.js';
import { createEntityRegistry } from '../../core/entity-component-system.js';
import { components } from '../../../world/entities/components.js';

function makeEntity(extra) {
  const registry = createEntityRegistry();
  const e = registry.createEntity();
  extra(registry, e);
  return e;
}

const player = () =>
  makeEntity((r, e) => {
    r.addComponent(e, 'name', components.name('Player'));
    r.addComponent(e, 'playerControlled', components.playerControlled());
  });

const goblin = () =>
  makeEntity((r, e) => {
    r.addComponent(e, 'name', components.name('Goblin'));
  });

describe('log-text', () => {
  it('detects the player via the playerControlled component', () => {
    expect(isPlayer(player())).toBe(true);
    expect(isPlayer(goblin())).toBe(false);
  });

  it('renders the player in second person and creatures in third', () => {
    expect(subject(player())).toBe('You');
    expect(subject(goblin())).toBe('The Goblin');
    expect(object(player())).toBe('you');
    expect(object(goblin())).toBe('the Goblin');
  });

  it('conjugates verbs to agree with the actor', () => {
    expect(conjugate(player(), 'pick up', 'picks up')).toBe('pick up');
    expect(conjugate(goblin(), 'pick up', 'picks up')).toBe('picks up');
  });

  it('falls back to "creature" when an entity has no name', () => {
    const nameless = makeEntity(() => {});
    expect(subject(nameless)).toBe('The creature');
  });

  it('lowercases item names for mid-sentence use', () => {
    const potion = makeEntity((r, e) =>
      r.addComponent(e, 'name', components.name('Healing Potion')),
    );
    expect(itemName(potion)).toBe('healing potion');
  });
});
