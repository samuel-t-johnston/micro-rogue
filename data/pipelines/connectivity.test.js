import { describe, it, expect } from 'vitest';
import walker from './walker.js';
import bsp from './bsp.js';
import ca from './ca.js';
import composite from './composite.js';
import procedural3x3 from './procedural-3x3.js';
import { runPipeline } from '../../src/world/generation/pipeline.js';
import { centermostRoomTile } from '../../src/world/generation/zone-tiles.js';
import { getTileType } from '../../src/world/map/tile-registry.js';
import { createEntityRegistry } from '../../src/engine/core/entity-component-system.js';
import { createRng } from '../../src/engine/core/rng.js';

// A shared invariant over every procedural pipeline: the whole level is reachable from where the
// player arrives. A disconnected level (a stranded room, an unreachable exit) is the one generation
// bug that ruins a run — the walker's maxSteps fallback and BSP's spanning-tree connections exist to
// prevent it, and this pins it for all of them at once. Add new procedural pipelines to the list.
// Any pipeline that is purposely disconnected (e.g. portals, digging through walls) should be excluded from this test.
const PIPELINES = [
  ['walker', walker],
  ['bsp', bsp],
  ['ca', ca],
  ['composite', composite],
  ['procedural-3x3', procedural3x3],
];

async function generate(config, seed) {
  const registry = createEntityRegistry();
  const level = await runPipeline(config, createRng(seed), registry, {
    identity: { branch: 0, depth: 0 },
  });
  return { level, registry };
}

// Structural connectivity: flood over tiles the terrain lets you walk on, ignoring entities. Closed
// doors sit on floor and are openable, so they don't disconnect a level; walls do. 4-connected,
// matching how corridors are carved (and stricter than 8-connected).
function reachableFrom(level, start) {
  const walkable = (x, y) => {
    const id = level.getTile(x, y);
    if (!id) return false;
    try {
      return !getTileType(id).blocksMovement;
    } catch {
      return false;
    }
  };
  const seen = new Set();
  if (!walkable(start.x, start.y)) return seen;
  seen.add(`${start.x},${start.y}`);
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
      if (walkable(x + dx, y + dy) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen;
}

function entryTile(registry) {
  const [entry] = registry.getEntitiesWith('entryPoint');
  const pos = entry?.components.get('position');
  return pos ? { x: pos.x, y: pos.y } : null;
}

describe.each(PIPELINES)('%s pipeline connectivity', (name, config) => {
  it('reaches every room and every stair from the entry point, across seeds', async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { level, registry } = await generate(config, seed);

      const start = entryTile(registry);
      expect(start, `${name} seed ${seed}: no entry point`).not.toBeNull();
      const reached = reachableFrom(level, start);

      const zones = level.blackboard['level:zones'] ?? [];
      const rooms = level.blackboard['level:rooms'] ?? {};
      for (const zone of zones) {
        const tile = centermostRoomTile(zone, rooms);
        if (!tile) continue;
        expect(
          reached.has(`${tile[0]},${tile[1]}`),
          `${name} seed ${seed}: zone ${zone.id} unreachable from entry`,
        ).toBe(true);
      }

      for (const tr of registry.getEntitiesWith('transition')) {
        const pos = tr.components.get('position');
        expect(
          reached.has(`${pos.x},${pos.y}`),
          `${name} seed ${seed}: stair at (${pos.x},${pos.y}) unreachable from entry`,
        ).toBe(true);
      }
    }
  });
});
