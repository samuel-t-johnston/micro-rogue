import { describe, it, expect, vi } from 'vitest';
import { LayerStack } from './layers.js';

describe('LayerStack', () => {
  it('starts empty', () => {
    const stack = new LayerStack();
    expect(stack.size).toBe(0);
    expect(stack.top()).toBeUndefined();
  });

  it('push/pop tracks the top layer', () => {
    const stack = new LayerStack();
    const a = { id: 'a' };
    const b = { id: 'b' };
    stack.push(a);
    stack.push(b);
    expect(stack.top()).toBe(b);
    expect(stack.pop()).toBe(b);
    expect(stack.top()).toBe(a);
  });

  it('render iterates bottom-up so upper layers paint over lower', () => {
    const calls = [];
    const stack = new LayerStack();
    stack.push({ render: () => calls.push('bottom') });
    stack.push({ render: () => calls.push('top') });
    stack.render({});
    expect(calls).toEqual(['bottom', 'top']);
  });

  it('handleInput delivers top-down and stops when a layer returns true', () => {
    const stack = new LayerStack();
    const bottom = { handleInput: vi.fn(() => true) };
    const top = { handleInput: vi.fn(() => false) };
    stack.push(bottom);
    stack.push(top);

    const handled = stack.handleInput({ type: 'pointerdown' });

    expect(handled).toBe(true);
    expect(top.handleInput).toHaveBeenCalledTimes(1);
    expect(bottom.handleInput).toHaveBeenCalledTimes(1);
  });

  it('handleInput stops at the first handler that returns true', () => {
    const stack = new LayerStack();
    const bottom = { handleInput: vi.fn(() => true) };
    const top = { handleInput: vi.fn(() => true) };
    stack.push(bottom);
    stack.push(top);

    const handled = stack.handleInput({ type: 'pointerdown' });

    expect(handled).toBe(true);
    expect(top.handleInput).toHaveBeenCalledTimes(1);
    expect(bottom.handleInput).not.toHaveBeenCalled();
  });

  it('tolerates layers missing render/handleInput', () => {
    const stack = new LayerStack();
    stack.push({});
    expect(() => stack.render({})).not.toThrow();
    expect(stack.handleInput({})).toBe(false);
  });
});
