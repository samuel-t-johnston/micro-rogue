import { describe, it, expect } from 'vitest';
import {
  isPlayer,
  subject,
  object,
  conjugate,
  possessive,
  quantitySuffix,
  itemName,
  displayName,
} from './log-text.js';
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

  it('renders the possessive in agreement with the actor', () => {
    expect(possessive(player())).toBe('your');
    expect(possessive(goblin())).toBe('its');
  });

  const stack = (count) =>
    makeEntity((r, e) => {
      r.addComponent(e, 'name', components.name('Arrow'));
      r.addComponent(e, 'stackable', components.stackable(100, count));
    });

  it('suffixes a stack quantity only when more than one', () => {
    expect(quantitySuffix(stack(20))).toBe(' (20)');
    expect(quantitySuffix(stack(1))).toBe('');
    expect(quantitySuffix(goblin())).toBe(''); // no stackable component
  });

  it('appends the stack quantity to item names', () => {
    expect(itemName(stack(20))).toBe('arrow (20)');
    expect(itemName(stack(1))).toBe('arrow');
  });

  it('displayName keeps authored casing and appends the quantity', () => {
    expect(displayName(stack(20))).toBe('Arrow (20)');
    expect(displayName(goblin())).toBe('Goblin');
  });

  it('displayName uses the given fallback when unnamed', () => {
    const nameless = makeEntity(() => {});
    expect(displayName(nameless, 'Item')).toBe('Item');
    expect(displayName(nameless)).toBe('Unknown');
  });
});
