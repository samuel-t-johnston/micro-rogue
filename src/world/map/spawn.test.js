import { describe, it, expect, vi } from 'vitest';
import { resolveSpawn, resolveArrival } from './spawn.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../entities/components.js';

function makeEntry(registry, x, y) {
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'entryPoint', components.entryPoint());
  return e;
}

function makeStair(registry, x, y, port) {
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'transition', components.transition(null, port));
  return e;
}

describe('spawn/exit components', () => {
  it('entryPoint is a tag; transition carries a nullable destination and a port', () => {
    expect(components.entryPoint()).toEqual({});
    expect(components.transition()).toEqual({ to: null, port: null });
    expect(components.transition({ branch: 0, depth: 1 }, 'down')).toEqual({
      to: { branch: 0, depth: 1 },
      port: 'down',
    });
  });
});

describe('resolveSpawn', () => {
  it('returns the entryPoint entity position', () => {
    const reg = createEntityRegistry();
    makeEntry(reg, 4, 7);
    expect(resolveSpawn(reg, { width: 20, height: 20 })).toEqual({ x: 4, y: 7 });
  });

  it('falls back to the level centre with a warning when none is marked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = createEntityRegistry();
    expect(resolveSpawn(reg, { width: 10, height: 8 })).toEqual({ x: 5, y: 4 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('picks one (and warns) when several entry points exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = createEntityRegistry();
    makeEntry(reg, 1, 1);
    makeEntry(reg, 2, 2);
    const spawn = resolveSpawn(reg, { width: 20, height: 20 });
    expect([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]).toContainEqual(spawn);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('resolveArrival', () => {
  it('lands on the stair whose port matches (you arrive on the stair you would return by)', () => {
    const reg = createEntityRegistry();
    makeStair(reg, 3, 3, 'up');
    makeStair(reg, 8, 8, 'down');
    expect(resolveArrival(reg, { width: 20, height: 20 }, 'down')).toEqual({ x: 8, y: 8 });
    expect(resolveArrival(reg, { width: 20, height: 20 }, 'up')).toEqual({ x: 3, y: 3 });
  });

  it('matches a custom port (e.g. a branch stair)', () => {
    const reg = createEntityRegistry();
    makeStair(reg, 3, 3, 'up');
    makeStair(reg, 5, 6, 'branch1');
    expect(resolveArrival(reg, { width: 20, height: 20 }, 'branch1')).toEqual({ x: 5, y: 6 });
  });

  it('falls back to the entry point (with a warning) when no port matches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = createEntityRegistry();
    makeEntry(reg, 2, 2);
    makeStair(reg, 3, 3, 'up'); // no 'down' stair here (e.g. a bottom floor)
    expect(resolveArrival(reg, { width: 20, height: 20 }, 'down')).toEqual({ x: 2, y: 2 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
