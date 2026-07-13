import { describe, it, expect, vi } from 'vitest';
import { createQuantityStepper } from './quantity-stepper.js';

// The keydown path exercises the clamp/step logic without any geometry.
function make({ min, max, initial } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const stepper = createQuantityStepper({
    theme: {},
    getViewport: () => ({ width: 400, height: 600 }),
    title: 'Split',
    min,
    max,
    initial,
    onConfirm,
    onCancel,
  });
  return { stepper, onConfirm, onCancel };
}
const key = (k) => ({ type: 'keydown', key: k });

describe('quantity-stepper', () => {
  it('clamps the initial value into [min, max]', () => {
    const { stepper, onConfirm } = make({ min: 1, max: 5, initial: 10 });
    stepper.handleInput(key('Enter'));
    expect(onConfirm).toHaveBeenCalledWith(5);
  });

  it('steps up (ArrowUp / ArrowRight) but not past max', () => {
    const { stepper, onConfirm } = make({ min: 1, max: 3, initial: 2 });
    stepper.handleInput(key('ArrowUp')); // 3
    stepper.handleInput(key('ArrowRight')); // clamped at 3
    stepper.handleInput(key('Enter'));
    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('steps down (ArrowDown / ArrowLeft) but not below min', () => {
    const { stepper, onConfirm } = make({ min: 1, max: 3, initial: 2 });
    stepper.handleInput(key('ArrowDown')); // 1
    stepper.handleInput(key('ArrowLeft')); // clamped at 1
    stepper.handleInput(key('Enter'));
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('confirms the current stepped value on Enter', () => {
    const { stepper, onConfirm } = make({ min: 0, max: 10, initial: 5 });
    stepper.handleInput(key('ArrowUp')); // 6
    stepper.handleInput(key('ArrowUp')); // 7
    stepper.handleInput(key('Enter'));
    expect(onConfirm).toHaveBeenCalledWith(7);
  });

  it('cancels on Escape', () => {
    const { stepper, onConfirm, onCancel } = make({ min: 1, max: 5, initial: 2 });
    stepper.handleInput(key('Escape'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
