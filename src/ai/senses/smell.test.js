import { describe, it, expect } from 'vitest';
import { createSmellSense } from './smell.js';
import { createLevel } from '../../world/map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';
import { depositScent } from '../../world/sense-systems/scent.js';

const smell = createSmellSense();

function setup({ threshold = 0 } = {}) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 10;
  level.height = 10;
  level.tiles = Array.from({ length: 10 }, () => Array(10).fill('floor'));
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(5, 5));
  registry.addComponent(e, 'smell', components.smell(threshold));
  level.placeEntity(e);
  return { level, e };
}

describe('smell sense', () => {
  it('reports a profile above threshold, with the gradient direction toward the source', () => {
    const { level, e } = setup({ threshold: 1 });
    depositScent(level, 'player', 5, 5, 10);
    depositScent(level, 'player', 6, 5, 30); // strongest immediately east → gradient points E
    const { smells } = smell(e, level, 3);
    expect(smells).toHaveLength(1);
    expect(smells[0]).toMatchObject({ profile: 'player', direction: 'E', turnObserved: 3 });
    expect(smells[0].intensity).toBeGreaterThan(0);
  });

  it('does not report a scent below the threshold', () => {
    const { level, e } = setup({ threshold: 50 });
    depositScent(level, 'player', 5, 5, 10); // 10 < 50
    expect(smell(e, level, 0).smells).toHaveLength(0);
  });

  it('reports nothing without a smell component (no nose)', () => {
    const { level, e } = setup({ threshold: 0 });
    e.components.delete('smell');
    depositScent(level, 'player', 5, 5, 10);
    expect(smell(e, level, 0).smells).toHaveLength(0);
  });

  it('reports no entities and no visible tiles', () => {
    const { level, e } = setup({ threshold: 0 });
    depositScent(level, 'player', 5, 5, 10);
    const r = smell(e, level, 0);
    expect(r.entities).toEqual([]);
    expect(r.visibleTiles.size).toBe(0);
  });
});
