import { describe, it, expect } from 'vitest';
import { registerGoal, resolveGoals } from './goal-registry.js';

describe('goal-registry', () => {
  it('resolves a runtime-registered goal by name', () => {
    const custom = { evaluate: () => null };
    registerGoal('test:custom-goal', custom);
    expect(resolveGoals(['test:custom-goal'])).toEqual([custom]);
  });

  it('resolves names in order (= priority)', () => {
    const a = { evaluate: () => null };
    const b = { evaluate: () => null };
    registerGoal('test:a', a);
    registerGoal('test:b', b);
    expect(resolveGoals(['test:b', 'test:a'])).toEqual([b, a]);
  });

  it('throws on an unknown goal name', () => {
    expect(() => resolveGoals(['test:nope'])).toThrow(/Unknown goal/);
  });
});
