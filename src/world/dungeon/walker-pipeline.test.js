import { describe, it, expect } from 'vitest';
import walker from '../../../data/pipelines/walker.js';
import { runPipeline } from '../generation/pipeline.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createRng } from '../../engine/core/rng.js';

// Generate the shipped walker floor headlessly — the per-pipeline generation test the dungeon-planner
// design recommends: it exercises the real config end to end and pins the connection contract.
async function generate(seed) {
  const registry = createEntityRegistry();
  const level = await runPipeline(walker, createRng(seed), registry, {
    identity: { branch: 1, depth: 1 },
  });
  return { level, registry };
}

// Every node centre reachable over floor from the entry point — the whole floor is traversable.
function fullyConnected(level) {
  const nodes = level.blackboard['level:nodes'];
  const floor = (x, y) => level.getTile(x, y) === 'floor';
  const start = nodes[0];
  const seen = new Set([`${start.x},${start.y}`]);
  const stack = [[start.x, start.y]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${y + dy}`;
      if (floor(x + dx, y + dy) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return nodes.every((n) => seen.has(`${n.x},${n.y}`));
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

  it('produces a fully connected floor across seeds', async () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { level } = await generate(seed);
      expect(fullyConnected(level)).toBe(true);
    }
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
