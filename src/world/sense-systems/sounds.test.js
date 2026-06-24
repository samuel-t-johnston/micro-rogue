import { describe, it, expect } from 'vitest';
import { emitSound } from './sounds.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('emitSound', () => {
  it('creates an invisible, decaying sound entity placed on the level', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();

    const sound = emitSound(registry, level, {
      sourceId: 7,
      x: 2,
      y: 3,
      volume: 8,
      language: 'orcish',
      message: { kind: 'enemy-report', direction: 'NW' },
    });

    expect(sound.components.get('position')).toEqual({ x: 2, y: 3 });
    expect(sound.components.get('sound')).toEqual({
      sourceId: 7,
      volume: 8,
      language: 'orcish',
      message: { kind: 'enemy-report', direction: 'NW' },
      sourceFactions: [],
    });
    expect(sound.components.get('decay').lifespan).toBe(2);
    expect(level.getEntitiesAt(2, 3).has(sound)).toBe(true);
    // Inert: nothing that would let it block movement, draw, or read as a creature.
    expect(sound.components.has('blocksMovement')).toBe(false);
    expect(sound.components.has('renderable')).toBe(false);
    expect(sound.components.has('creature')).toBe(false);
  });

  it('honors an explicit lifespan', () => {
    const registry = createEntityRegistry();
    const sound = emitSound(registry, makeLevel(), { x: 0, y: 0, volume: 1, lifespan: 5 });
    expect(sound.components.get('decay').lifespan).toBe(5);
  });

  it("snapshots the emitter's factions onto the sound", () => {
    const registry = createEntityRegistry();
    const sound = emitSound(registry, makeLevel(), {
      x: 0,
      y: 0,
      volume: 1,
      sourceFactions: ['orcs'],
    });
    expect(sound.components.get('sound').sourceFactions).toEqual(['orcs']);
  });
});
