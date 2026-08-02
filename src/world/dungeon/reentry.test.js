import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../map/level.js';
import { freezeLevel } from './cold-storage.js';
import { getReentryPolicy, DEFAULT_POLICY } from './reentry.js';

describe('reentry policy registry', () => {
  it('defaults to thaw when no policy name is given', () => {
    expect(DEFAULT_POLICY).toBe('thaw');
    expect(getReentryPolicy()).toBe(getReentryPolicy('thaw'));
  });

  it('throws on an unknown policy name', () => {
    expect(() => getReentryPolicy('nope')).toThrow(/unknown reentry policy/i);
  });
});

describe('thaw policy', () => {
  it('restores the frozen level and hands back its frozen player memory', async () => {
    const registry = createEntityRegistry();
    const level = createLevel({ branch: 0, depth: 1, epoch: 0 });
    level.width = 3;
    level.height = 3;
    level.tiles = Array.from({ length: 3 }, () => Array(3).fill('floor'));
    const blob = freezeLevel(registry, level);
    blob.playerMemory = { memory: [['1,1', 'floor']], rememberedEntities: [] };

    const result = await getReentryPolicy('thaw')(blob, { id: 'a' }, { registry });

    expect(result.level.width).toBe(3);
    expect(result.level.getTile(0, 0)).toBe('floor');
    expect(result.playerMemory).toBe(blob.playerMemory);
  });
});

describe('regen policy', () => {
  it('rebuilds on the next epoch and starts the floor dark', async () => {
    const calls = [];
    const fresh = { id: 'fresh-level' };
    const generate = async (node, epoch) => {
      calls.push([node, epoch]);
      return fresh;
    };
    const node = { id: 'a', branch: 0, depth: 0 };
    const blob = { level: { epoch: 0 }, playerMemory: { memory: [['1,1', 'floor']] } };

    const result = await getReentryPolicy('regen')(blob, node, { generate });

    expect(calls).toEqual([[node, 1]]); // rebuilt at epoch 1
    expect(result.level).toBe(fresh);
    expect(result.playerMemory).toBeNull(); // stale layout memory is discarded
    expect(result.carriedOver).toEqual([]); // an entity-less floor carries nothing over
  });

  it('increments from the frozen epoch (2 → 3)', async () => {
    let seen;
    const generate = async (_node, epoch) => {
      seen = epoch;
      return {};
    };
    await getReentryPolicy('regen')({ level: { epoch: 2 } }, { id: 'a' }, { generate });
    expect(seen).toBe(3);
  });

  it('treats a blob with no epoch as epoch 0 (regenerates at epoch 1)', async () => {
    let seen;
    const generate = async (_node, epoch) => {
      seen = epoch;
      return {};
    };
    await getReentryPolicy('regen')({ level: {} }, { id: 'a' }, { generate });
    expect(seen).toBe(1);
  });
});
