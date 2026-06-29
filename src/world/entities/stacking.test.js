import { describe, it, expect, beforeEach } from 'vitest';
import { splitStack } from './stacking.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from './components.js';

describe('splitStack', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
  });

  function makeArrows(count, maxStackSize = 100) {
    const e = registry.createEntity();
    registry.addComponent(e, 'name', components.name('Arrow'));
    registry.addComponent(e, 'ammunition', components.ammunition('arrow', 0.5, { N: 'arrow-n' }));
    registry.addComponent(e, 'stackable', components.stackable(maxStackSize, count));
    return e;
  }

  it('peels one unit off a larger stack into a new entity', () => {
    const arrows = makeArrows(20);
    const one = splitStack(arrows, 1, registry);

    expect(one).not.toBe(arrows);
    expect(one.components.get('stackable').count).toBe(1);
    expect(arrows.components.get('stackable').count).toBe(19);
  });

  it('copies the source components onto the split-off entity', () => {
    const arrows = makeArrows(20);
    const one = splitStack(arrows, 1, registry);

    expect(one.components.get('name')).toBe('Arrow');
    expect(one.components.get('ammunition')).toEqual({
      ammoType: 'arrow',
      breakChance: 0.5,
      attackSprites: { N: 'arrow-n' },
    });
  });

  it('deep-copies components so the clone and source do not share references', () => {
    const arrows = makeArrows(20);
    const one = splitStack(arrows, 1, registry);

    one.components.get('ammunition').attackSprites.N = 'changed';
    expect(arrows.components.get('ammunition').attackSprites.N).toBe('arrow-n');
  });

  it('registers the clone in the registry and its component index', () => {
    const arrows = makeArrows(20);
    const one = splitStack(arrows, 1, registry);

    expect(registry.getEntity(one.id)).toBe(one);
    expect([...registry.getEntitiesWith('ammunition')]).toContain(one);
  });

  it('splits several units at once', () => {
    const arrows = makeArrows(5);
    const two = splitStack(arrows, 2, registry);

    expect(two.components.get('stackable').count).toBe(2);
    expect(arrows.components.get('stackable').count).toBe(3);
  });

  it('returns the source itself when the whole stack is taken (last unit)', () => {
    const lastArrow = makeArrows(1);
    const result = splitStack(lastArrow, 1, registry);

    expect(result).toBe(lastArrow);
    expect(lastArrow.components.get('stackable').count).toBe(1); // unchanged; caller removes it
  });

  it('returns the source when n meets or exceeds the count', () => {
    const arrows = makeArrows(3);
    expect(splitStack(arrows, 3, registry)).toBe(arrows);
    expect(splitStack(arrows, 9, registry)).toBe(arrows);
    expect(arrows.components.get('stackable').count).toBe(3);
  });

  it('treats an item with no stackable component as a single unit', () => {
    const javelin = registry.createEntity();
    registry.addComponent(javelin, 'name', components.name('Javelin'));
    expect(splitStack(javelin, 1, registry)).toBe(javelin);
  });

  it('rejects a non-positive split count', () => {
    const arrows = makeArrows(20);
    expect(() => splitStack(arrows, 0, registry)).toThrow();
  });
});
