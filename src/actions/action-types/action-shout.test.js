import { describe, it, expect } from 'vitest';
import { executeShout } from './action-shout.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../../world/level.js';
import { components } from '../../world/components.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

function makeActor(registry, level, { withVoice = true } = {}) {
  const actor = registry.createEntity();
  registry.addComponent(actor, 'position', components.position(2, 2));
  if (withVoice) registry.addComponent(actor, 'voice', components.voice('orcish'));
  level.placeEntity(actor);
  return actor;
}

function soundsOnLevel(level) {
  return level.entities.filter(e => e.components.has('sound'));
}

describe('executeShout', () => {
  it('emits a sound at the actor\'s tile, stamped with the actor\'s voice language', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, level);

    executeShout(actor, { type: 'shout', volume: 8, message: { kind: 'enemy-report', direction: 'NW' } }, level, registry);

    const [sound] = soundsOnLevel(level);
    expect(sound.components.get('position')).toEqual({ x: 2, y: 2 });
    expect(sound.components.get('sound')).toMatchObject({
      sourceId: actor.id,
      volume: 8,
      language: 'orcish',
      message: { kind: 'enemy-report', direction: 'NW' },
    });
  });

  it('emits nothing when the actor has no voice (silenced), but still consumes the turn', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, level, { withVoice: false });

    const free = executeShout(actor, { type: 'shout', volume: 8, message: {} }, level, registry);

    expect(soundsOnLevel(level)).toHaveLength(0);
    expect(free).toBe(false);
  });

  it('returns false so shouting consumes a turn', () => {
    const registry = createEntityRegistry();
    const level = makeLevel();
    const actor = makeActor(registry, level);
    expect(executeShout(actor, { type: 'shout', volume: 5, message: {} }, level, registry)).toBe(false);
  });
});
