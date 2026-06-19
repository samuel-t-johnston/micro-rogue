import { describe, it, expect, beforeEach } from 'vitest';
import { upkeep } from './upkeep.js';

describe('upkeep', () => {
  beforeEach(() => upkeep.reset());

  it('runs registered steps in registration order, passing the context', () => {
    const calls = [];
    upkeep.register('a', (ctx) => calls.push(['a', ctx.n]));
    upkeep.register('b', (ctx) => calls.push(['b', ctx.n]));
    upkeep.run({ n: 7 });
    expect(calls).toEqual([['a', 7], ['b', 7]]);
  });

  it('replaces a step by name without changing its position', () => {
    const order = [];
    upkeep.register('first', () => order.push('first-v1'));
    upkeep.register('second', () => order.push('second'));
    upkeep.register('first', () => order.push('first-v2')); // replace in place
    upkeep.run({});
    expect(order).toEqual(['first-v2', 'second']);
  });

  it('reset removes all steps', () => {
    let ran = false;
    upkeep.register('x', () => { ran = true; });
    upkeep.reset();
    upkeep.run({});
    expect(ran).toBe(false);
  });
});
