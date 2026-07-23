import { describe, it, expect } from 'vitest';
import composite from './composite.js';
import { runPipeline } from '../../src/world/generation/pipeline.js';
import { createEntityRegistry } from '../../src/engine/core/entity-component-system.js';
import { createRng } from '../../src/engine/core/rng.js';

// Generate the shipped composite floor headlessly — the per-pipeline generation test the
// dungeon-planner design recommends. (Full connectivity across the stitched sections is asserted for
// every procedural pipeline in connectivity.test.js.)
async function generate(seed) {
  const registry = createEntityRegistry();
  const level = await runPipeline(composite, createRng(seed), registry, {
    identity: { branch: 1, depth: 3 },
  });
  return { level, registry };
}

const creaturesNamed = (registry, name) =>
  registry.getEntitiesWith('ai').filter((e) => e.components.get('name') === name);

describe('composite pipeline (the shipped keep-and-cave floor)', () => {
  it('carries two districts: a tagged BSP keep and an inferred CA cave', async () => {
    const { level } = await generate(1);
    expect(level.width).toBe(56);
    const zones = level.blackboard['level:zones'];
    expect(zones.some((z) => z.section === 'keep' && z.origin == null)).toBe(true); // BSP, tagged
    expect(zones.some((z) => z.section === 'cave' && z.origin === 'inferred')).toBe(true); // CA
  });

  it('places exactly the declared up-stair transition (leaf floor)', async () => {
    const { registry } = await generate(1);
    const ports = registry
      .getEntitiesWith('transition')
      .map((t) => t.components.get('transition').port);
    expect(ports).toEqual(['up']);
    expect(registry.getEntitiesWith('entryPoint')).toHaveLength(1);
  });

  it('garrisons orcs in the west keep and vermin in the east cave (district population)', async () => {
    const { registry } = await generate(2);
    const orcs = [...creaturesNamed(registry, 'Orc'), ...creaturesNamed(registry, 'Orc Commander')];
    const cave = [...creaturesNamed(registry, 'Goblin'), ...creaturesNamed(registry, 'Scuttler')];
    expect(orcs.length).toBeGreaterThan(0);
    expect(cave.length).toBeGreaterThan(0);
    for (const o of orcs) expect(o.components.get('position').x).toBeLessThan(28); // keep is the west half
    for (const c of cave) expect(c.components.get('position').x).toBeGreaterThanOrEqual(28); // cave is the east half
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
