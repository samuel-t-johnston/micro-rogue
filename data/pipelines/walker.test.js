import { describe, it, expect } from 'vitest';
import walker from './walker.js';
import { runPipeline } from '../../src/world/generation/pipeline.js';
import { createEntityRegistry } from '../../src/engine/core/entity-component-system.js';
import { createRng } from '../../src/engine/core/rng.js';

// Generate the shipped walker floor headlessly — the per-pipeline generation test the dungeon-planner
// design recommends: it exercises the real config end to end and pins the connection contract.
// (Full-level connectivity is asserted for every procedural pipeline in connectivity.test.js.)
async function generate(seed) {
  const registry = createEntityRegistry();
  const level = await runPipeline(walker, createRng(seed), registry, {
    identity: { branch: 1, depth: 1 },
  });
  return { level, registry };
}

describe('walker pipeline (the shipped cave floor)', () => {
  it('generates a tiled level of the configured size', async () => {
    const { level } = await generate(1);
    expect(level.width).toBe(56);
    expect(level.height).toBe(40);
    expect(level.blackboard['level:nodes'].length).toBeGreaterThan(0);
  });

  it('places exactly the declared up-stair transition (and no down-stair)', async () => {
    const { registry } = await generate(1);
    const ports = registry
      .getEntitiesWith('transition')
      .map((t) => t.components.get('transition').port);
    expect(ports).toEqual(['up']);
  });

  it('marks a player entry point', async () => {
    const { registry } = await generate(1);
    expect(registry.getEntitiesWith('entryPoint')).toHaveLength(1);
  });

  it('populates chambers with creatures and items', async () => {
    const { registry } = await generate(2);
    expect(registry.getEntitiesWith('ai').length).toBeGreaterThan(0);
    expect(registry.getEntitiesWith('item').length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', async () => {
    const fingerprint = async (s) => {
      const { level, registry } = await generate(s);
      return {
        tiles: level.tiles,
        entities: registry
          .getEntitiesWith('position')
          .map((e) => {
            const p = e.components.get('position');
            return `${e.components.get('name') ?? '?'}@${p.x},${p.y}`;
          })
          .sort(),
      };
    };
    expect(await fingerprint(4)).toEqual(await fingerprint(4));
  });
});
