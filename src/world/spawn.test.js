import { describe, it, expect, vi } from 'vitest';
import { resolveSpawn } from './spawn.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from './components.js';

function makeEntry(registry, x, y) {
  const e = registry.createEntity();
  registry.addComponent(e, 'position', components.position(x, y));
  registry.addComponent(e, 'entryPoint', components.entryPoint());
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
