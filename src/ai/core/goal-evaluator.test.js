import { describe, it, expect } from 'vitest';
import { evaluateGoals } from './goal-evaluator.js';

const act = (action) => ({ evaluate: async () => ({ action }) });
const pass = { evaluate: async () => null };

describe('evaluateGoals', () => {
  it('returns the first goal that produces an action', async () => {
    const result = await evaluateGoals([pass, act('a'), act('b')], {});
    expect(result).toEqual({ action: 'a' });
  });

  it('returns null when no goal activates', async () => {
    expect(await evaluateGoals([pass, pass], {})).toBeNull();
  });

  it('calls onSelect with the winning goal and its index', async () => {
    const winner = act('a');
    const calls = [];
    await evaluateGoals([pass, winner, act('b')], {}, (goal, i) => calls.push([goal, i]));
    expect(calls).toEqual([[winner, 1]]);
  });

  it('does not call onSelect when nothing activates', async () => {
    let called = false;
    await evaluateGoals([pass, pass], {}, () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});
