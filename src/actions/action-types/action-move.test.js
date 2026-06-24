import { describe, it, expect } from 'vitest';
import { executeMove } from './action-move.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

function makeMover(registry, level, noisy) {
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(2, 2));
  registry.addComponent(e, 'faction', components.faction(['scuttlers']));
  if (noisy) registry.addComponent(e, 'noisyMovement', components.noisyMovement(noisy));
  level.placeEntity(e);
  return e;
}

const soundsOn = (level) => level.entities.filter((e) => e.components.has('sound'));

describe('executeMove noisy movement', () => {
  it('emits a sound at the new tile when a noisy mover moves (chance 1)', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const e = makeMover(registry, level, {
      chance: 1,
      volume: 3,
      message: { kind: 'vermin-scrabble' },
    });

    executeMove(e, { x: 3, y: 2 }, level, registry);

    const [sound] = soundsOn(level);
    expect(sound.components.get('position')).toEqual({ x: 3, y: 2 });
    expect(sound.components.get('sound')).toMatchObject({
      sourceId: e.id,
      volume: 3,
      language: null,
      message: { kind: 'vermin-scrabble' },
      sourceFactions: ['scuttlers'],
    });
  });

  it('emits nothing when the chance is 0', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const e = makeMover(registry, level, {
      chance: 0,
      volume: 3,
      message: { kind: 'vermin-scrabble' },
    });
    executeMove(e, { x: 3, y: 2 }, level, registry);
    expect(soundsOn(level)).toHaveLength(0);
  });

  it('emits nothing for a mover without a noisyMovement component', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const e = makeMover(registry, level, null);
    executeMove(e, { x: 3, y: 2 }, level, registry);
    expect(soundsOn(level)).toHaveLength(0);
  });
});
