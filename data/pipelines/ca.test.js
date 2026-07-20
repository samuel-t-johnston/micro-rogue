import { describe, it, expect } from 'vitest';
import ca from './ca.js';
import { runPipeline } from '../../src/world/generation/pipeline.js';
import { createEntityRegistry } from '../../src/engine/core/entity-component-system.js';
import { createRng } from '../../src/engine/core/rng.js';

// Generate the shipped CA cave floor headlessly — the per-pipeline generation test the dungeon-planner
// design recommends. (Full-level connectivity is asserted for every procedural pipeline in
// connectivity.test.js.)
async function generate(seed) {
  const registry = createEntityRegistry();
  const level = await runPipeline(ca, createRng(seed), registry, {
    identity: { branch: 1, depth: 2 },
  });
  return { level, registry };
}

describe('ca pipeline (the shipped cave floor)', () => {
  it('generates a tiled level of the configured size with inferred regions', async () => {
    const { level } = await generate(1);
    expect(level.width).toBe(56);
    expect(level.height).toBe(40);
    const zones = level.blackboard['level:zones'];
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((z) => z.origin === 'inferred')).toBe(true);
    expect(zones.some((z) => z.kind === 'chamber')).toBe(true);
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
