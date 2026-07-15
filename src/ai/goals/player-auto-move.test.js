import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../world/map/pathfinding.js', () => ({ findPath: vi.fn() }));
vi.mock('../senses/salience-monitor.js', () => ({ diff: vi.fn(() => ({ alerted: false })) }));

import { findPath } from '../../world/map/pathfinding.js';
import { diff } from '../senses/salience-monitor.js';
import { playerAutoMove } from './player-auto-move.js';

const DELAY = 150;

function ctx({
  target = { x: 5, y: 5 },
  pos = { x: 1, y: 1 },
  hasPendingInput = () => false,
} = {}) {
  return {
    memory: { autoMoveTarget: target, autoMoveBaseline: { hp: 20 } },
    selfState: { position: pos },
    level: {},
    hasPendingInput,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  diff.mockReturnValue({ alerted: false });
  findPath.mockReturnValue([
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ]);
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('playerAutoMove — cancel paths', () => {
  it('returns null when no target is armed', async () => {
    const context = ctx();
    delete context.memory.autoMoveTarget;
    expect(await playerAutoMove.evaluate(context)).toBeNull();
  });

  it('cancels and clears when a player input is buffered', async () => {
    const context = ctx({ hasPendingInput: () => true });
    expect(await playerAutoMove.evaluate(context)).toBeNull();
    expect(context.memory.autoMoveTarget).toBeUndefined();
    expect(context.memory.autoMoveBaseline).toBeUndefined();
    expect(findPath).not.toHaveBeenCalled(); // bailed before pathing
  });

  it('cancels when the salience monitor flags an alert', async () => {
    diff.mockReturnValue({ alerted: true });
    const context = ctx();
    expect(await playerAutoMove.evaluate(context)).toBeNull();
    expect(context.memory.autoMoveTarget).toBeUndefined();
  });

  it('cancels when already standing on the target', async () => {
    const context = ctx({ pos: { x: 5, y: 5 }, target: { x: 5, y: 5 } });
    expect(await playerAutoMove.evaluate(context)).toBeNull();
    expect(context.memory.autoMoveTarget).toBeUndefined();
  });

  it('cancels when no path to the target exists', async () => {
    findPath.mockReturnValue(null);
    const context = ctx();
    expect(await playerAutoMove.evaluate(context)).toBeNull();
    expect(context.memory.autoMoveTarget).toBeUndefined();
  });
});

describe('playerAutoMove — stepping', () => {
  it('steps one tile along the path toward the target after the delay', async () => {
    const context = ctx();
    const promise = playerAutoMove.evaluate(context);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(await promise).toEqual({ action: { type: 'move', x: 2, y: 1 } });
    expect(context.memory.autoMoveTarget).toEqual({ x: 5, y: 5 }); // still armed for the next step
  });

  it('cancels if an input arrives during the inter-step delay', async () => {
    let pending = false;
    const context = ctx({ hasPendingInput: () => pending });
    const promise = playerAutoMove.evaluate(context); // suspends at the delay with no pending input
    pending = true; // tap lands mid-delay
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(await promise).toBeNull();
    expect(context.memory.autoMoveTarget).toBeUndefined();
  });
});
