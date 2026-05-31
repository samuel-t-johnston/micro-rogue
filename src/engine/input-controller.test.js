import { describe, it, expect } from 'vitest';
import { createInputController } from './input-controller.js';

describe('createInputController', () => {
  it('resolves waitForInput when submit is called', async () => {
    const ic = createInputController();
    const action = { type: 'move', x: 2, y: 3 };
    const promise = ic.waitForInput();
    ic.submit(action);
    expect(await promise).toBe(action);
  });

  it('returns the same pending promise on repeated waitForInput calls', () => {
    const ic = createInputController();
    const p1 = ic.waitForInput();
    const p2 = ic.waitForInput();
    expect(p1).toBe(p2);
  });

  it('creates a fresh promise after the previous one resolves', async () => {
    const ic = createInputController();
    const p1 = ic.waitForInput();
    ic.submit({ type: 'move', x: 1, y: 1 });
    await p1;
    const p2 = ic.waitForInput();
    expect(p2).not.toBe(p1);
  });

  it('isWaiting returns false before waitForInput is called', () => {
    const ic = createInputController();
    expect(ic.isWaiting()).toBe(false);
  });

  it('isWaiting returns true after waitForInput is called', () => {
    const ic = createInputController();
    ic.waitForInput();
    expect(ic.isWaiting()).toBe(true);
  });

  it('isWaiting returns false after submit resolves the promise', async () => {
    const ic = createInputController();
    const p = ic.waitForInput();
    ic.submit({ type: 'move', x: 0, y: 0 });
    await p;
    expect(ic.isWaiting()).toBe(false);
  });

  it('submit is a no-op when nothing is waiting', () => {
    const ic = createInputController();
    expect(() => ic.submit({ type: 'move', x: 0, y: 0 })).not.toThrow();
  });
});
