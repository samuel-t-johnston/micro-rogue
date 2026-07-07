import { describe, it, expect } from 'vitest';
import { isDamageable } from './targeting.js';
import { createEntityRegistry } from '../engine/core/entity-component-system.js';
import { components } from '../world/entities/components.js';

describe('isDamageable', () => {
  const registry = createEntityRegistry();
  const withAttrs = (attrs) => {
    const e = registry.createEntity();
    registry.addComponent(e, 'attributes', components.attributes(attrs));
    return e;
  };

  it('is true for a creature that stores only its hp base (undamaged, current defaults to full)', () => {
    expect(isDamageable(withAttrs({ hpBase: 5 }))).toBe(true);
  });

  it('is true for a creature with a stored current hp', () => {
    expect(isDamageable(withAttrs({ hp: 3, hpBase: 5 }))).toBe(true);
  });

  it('is false for an entity with no hp pool', () => {
    expect(isDamageable(withAttrs({ str: 5, mp: 2 }))).toBe(false);
  });

  it('is false for an entity with no attributes at all', () => {
    expect(isDamageable(registry.createEntity())).toBe(false);
  });
});
