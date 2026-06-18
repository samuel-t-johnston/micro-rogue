// Verifies the goal-driving bookkeeping in invokeAction: the winning goal's key is
// recorded on the entity's `ai` component (read by the debug goal inspector) and a
// debug-only `goalChange` log entry is emitted only when that goal changes.
//
// The goal registry is mocked so each test can drive exactly which goal wins per turn.
// `goalActs` maps a goal key to whether its evaluate() returns an action this turn;
// goals that act dispatch a dependency-free `wait`.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { goalActs } = vi.hoisted(() => ({ goalActs: new Map() }));

vi.mock('../ai/goals/goal-registry.js', () => ({
  resolveGoals: names =>
    names.map(name => ({
      evaluate: () => (goalActs.get(name) ? { action: { type: 'wait' } } : null),
    })),
}));

import { createActionSystem } from './action-system.js';
import { gameLog } from '../engine/game-log.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { createLevel } from '../world/level.js';
import { components } from '../world/components.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('invokeAction goal bookkeeping', () => {
  let registry, level, system, entity;

  beforeEach(() => {
    gameLog.reset();
    goalActs.clear();
    registry = createEntityRegistry();
    level = makeLevel();
    const inputController = { waitForInput: () => {}, hasPendingInput: () => false };
    system = createActionSystem({ level, inputController, registry, dialogController: {} });

    entity = registry.createEntity();
    registry.addComponent(entity, 'name', components.name('Goblin'));
    registry.addComponent(entity, 'position', components.position(2, 2));
    registry.addComponent(entity, 'ai', components.ai(['high', 'low']));
    level.placeEntity(entity);
  });

  function goalChanges() {
    return gameLog.getAll().filter(e => e.action === 'goalChange');
  }

  it('records the winning goal on ai.lastGoal and logs the first activation', async () => {
    goalActs.set('high', false); // falls through
    goalActs.set('low', true); // acts

    await system.invokeAction(entity);

    expect(entity.components.get('ai').lastGoal).toBe('low');
    expect(goalChanges()).toMatchObject([{ prevGoal: null, newGoal: 'low' }]);
  });

  it('does not log a goalChange when the same goal wins two turns running', async () => {
    goalActs.set('low', true);

    await system.invokeAction(entity);
    await system.invokeAction(entity);

    expect(entity.components.get('ai').lastGoal).toBe('low');
    expect(goalChanges()).toHaveLength(1); // only the first turn
  });

  it('logs a goalChange with prev/new when the winning goal changes between turns', async () => {
    goalActs.set('low', true); // turn 1: only 'low' acts
    await system.invokeAction(entity);

    goalActs.set('high', true); // turn 2: 'high' now wins (higher priority)
    await system.invokeAction(entity);

    expect(entity.components.get('ai').lastGoal).toBe('high');
    expect(goalChanges()).toMatchObject([
      { prevGoal: null, newGoal: 'low' },
      { prevGoal: 'low', newGoal: 'high' },
    ]);
  });
});

describe('invokeAction decay handling', () => {
  let registry, level, system;

  beforeEach(() => {
    gameLog.reset();
    registry = createEntityRegistry();
    level = makeLevel();
    const inputController = { waitForInput: () => {}, hasPendingInput: () => false };
    system = createActionSystem({ level, inputController, registry, dialogController: {} });
  });

  function makeSound(lifespan) {
    const sound = registry.createEntity();
    registry.addComponent(sound, 'position', components.position(2, 2));
    registry.addComponent(sound, 'decay', components.decay(lifespan));
    level.placeEntity(sound);
    return sound;
  }

  it('decrements a decay entity\'s lifespan each turn without destroying it early', async () => {
    const sound = makeSound(2);
    await system.invokeAction(sound);
    expect(sound.components.get('decay').lifespan).toBe(1);
    expect(registry.getEntity(sound.id)).toBe(sound);
  });

  it('removes the entity from the level and registry when lifespan reaches 0', async () => {
    const sound = makeSound(1);
    await system.invokeAction(sound);
    expect(registry.getEntity(sound.id)).toBeNull();
    expect(level.entities).not.toContain(sound);
  });

  it('returns false (consumes the pass) so the turn loop advances', async () => {
    const sound = makeSound(2);
    expect(await system.invokeAction(sound)).toBe(false);
  });
});
