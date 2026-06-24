import { describe, it, expect, vi } from 'vitest';
import { AppState, createAppStateMachine } from './app-state.js';

function makeScene(label, calls) {
  return {
    label,
    enter: vi.fn(() => calls.push(`${label}.enter`)),
    exit: vi.fn(() => calls.push(`${label}.exit`)),
    render: vi.fn(),
    handleInput: vi.fn(),
  };
}

describe('app state machine', () => {
  it('throws when transitioning to an unregistered state', () => {
    const machine = createAppStateMachine();
    expect(() => machine.transition('nope')).toThrow();
  });

  it('calls enter on the new scene on first transition', () => {
    const calls = [];
    const splash = makeScene('splash', calls);
    const machine = createAppStateMachine();
    machine.register(AppState.SPLASH, () => splash);

    machine.transition(AppState.SPLASH);

    expect(machine.state).toBe(AppState.SPLASH);
    expect(calls).toEqual(['splash.enter']);
  });

  it('calls exit on the old scene and enter on the new on subsequent transitions', () => {
    const calls = [];
    const splash = makeScene('splash', calls);
    const menu = makeScene('menu', calls);
    const machine = createAppStateMachine();
    machine.register(AppState.SPLASH, () => splash);
    machine.register(AppState.MENU, () => menu);

    machine.transition(AppState.SPLASH);
    machine.transition(AppState.MENU);

    expect(machine.state).toBe(AppState.MENU);
    expect(calls).toEqual(['splash.enter', 'splash.exit', 'menu.enter']);
  });

  it('routes render and input to the active scene', () => {
    const calls = [];
    const splash = makeScene('splash', calls);
    const machine = createAppStateMachine();
    machine.register(AppState.SPLASH, () => splash);

    machine.transition(AppState.SPLASH);
    const fakeCtx = {};
    machine.render(fakeCtx);
    machine.handleInput({ type: 'pointerdown' });

    expect(splash.render).toHaveBeenCalledWith(fakeCtx);
    expect(splash.handleInput).toHaveBeenCalledWith({ type: 'pointerdown' });
  });

  it('produces a fresh scene per transition via the factory', () => {
    const factory = vi.fn(() => ({ render: () => {}, handleInput: () => {} }));
    const machine = createAppStateMachine();
    machine.register(AppState.SPLASH, factory);

    machine.transition(AppState.SPLASH);
    machine.transition(AppState.SPLASH);

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
