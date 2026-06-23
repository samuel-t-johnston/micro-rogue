import { describe, it, expect } from 'vitest';
import { createVisionSense } from './vision.js';
import { createLevel } from '../../world/level.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { components } from '../../world/components.js';

const vision = createVisionSense();

function setup(visionRange) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.width = 21;
  level.height = 21;
  level.tiles = Array.from({ length: 21 }, () => Array(21).fill('floor'));
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(10, 10));
  if (visionRange !== undefined) registry.addComponent(e, 'vision', components.vision(visionRange));
  level.placeEntity(e);
  return { level, e };
}

describe('vision acuity (range from the vision component)', () => {
  it('limits FOV to the component range', () => {
    const { level, e } = setup(3);
    const { visibleTiles } = vision(e, level, 0);
    expect(visibleTiles.has('13,10')).toBe(true); // 3 tiles east — within range 3
    expect(visibleTiles.has('14,10')).toBe(false); // 4 tiles east — beyond range 3
  });

  it('sees unlimited (open space) when there is no vision component', () => {
    const { level, e } = setup(undefined);
    const { visibleTiles } = vision(e, level, 0);
    expect(visibleTiles.has('20,10')).toBe(true); // far edge still visible
  });
});
