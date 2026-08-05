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

// Structural connectivity: flood over tiles the terrain lets you walk on. Closed doors sit on floor and
// are openable, so they don't disconnect a level; walls do. A secret door sits on WALL terrain but is a
// latent passage (revealable by searching), so a tile holding a `secret` entity counts as walkable when
// `secretsPassable` — the invariant is then "reachable, possibly by searching". 4-connected, matching
// how corridors are carved (and stricter than 8-connected).
function reachableFrom(level, start, { secretsPassable = true } = {}) {
  const walkable = (x, y) => {
    const id = level.getTile(x, y);
    if (!id) return false;
    let terrainOpen;
    try {
      terrainOpen = !getTileType(id).blocksMovement;
    } catch {
      return false;
    }
    if (terrainOpen) return true;
    if (!secretsPassable) return false;
    for (const e of level.getEntitiesAt(x, y)) if (e.components.has('secret')) return true;
    return false;
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

// Where the player actually arrives on a freshly generated floor: standing on the up-stair — the
// transition whose port the transit map lands them on (see resolveArrival). Every procedural floor
// declares an up-stair, so this is the connectivity flood-fill's seed.
function arrivalTile(registry) {
  const transitions = registry.getEntitiesWith('transition');
  const up =
    transitions.find((t) => t.components.get('transition').port === 'up') ?? transitions[0];
  const pos = up?.components.get('position');
  return pos ? { x: pos.x, y: pos.y } : null;
}

// Pipelines that place doors — the ones a secretDoors stage has something to convert. The stage is
// appended (runs last, after all carving), which is exactly how it dodges the re-floor problem that
// inline placement hit.
const DOOR_PIPELINES = [
  ['bsp', bsp],
  ['composite', composite],
  ['procedural-3x3', procedural3x3],
];

const withSecretStage = (config, secretDoors) => ({
  ...config,
  stages: [...config.stages, { type: 'secretDoors', ...secretDoors }],
});

describe.each(DOOR_PIPELINES)('%s + scope:"all" secret doors', (name, config) => {
  it('gates real paths yet stays reachable by searching', async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cfg = withSecretStage(config, { chance: 1, scope: 'all' });
      const { level, registry } = await generate(cfg, seed);
      const start = arrivalTile(registry);

      const secrets = registry.getEntitiesWith('secret');
      expect(secrets.length, `${name} seed ${seed}: no secrets placed`).toBeGreaterThan(0);
      // Every secret is disguised as wall terrain (not left on floor).
      for (const s of secrets) {
        const p = s.components.get('position');
        expect(getTileType(level.getTile(p.x, p.y)).blocksMovement).toBe(true);
      }

      // Latent passages counted: the whole level (every stair) is still reachable via searching.
      const reached = reachableFrom(level, start);
      for (const tr of registry.getEntitiesWith('transition')) {
        const p = tr.components.get('position');
        expect(
          reached.has(`${p.x},${p.y}`),
          `${name} seed ${seed}: stair (${p.x},${p.y}) unreachable even via search`,
        ).toBe(true);
      }
      // Treated as plain walls, the secrets strand something — proof they gate, not decorate.
      const strict = reachableFrom(level, start, { secretsPassable: false });
      expect(strict.size, `${name} seed ${seed}: 'all' secrets gated nothing`).toBeLessThan(
        reached.size,
      );
    }
  });
});

describe.each(DOOR_PIPELINES)('%s + scope:"redundant" secret doors', (name, config) => {
  it('never forces a search: every stair stays reachable over floor alone', async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cfg = withSecretStage(config, { chance: 1, scope: 'redundant' });
      const { level, registry } = await generate(cfg, seed);
      const start = arrivalTile(registry);
      // Redundant-only secrets sit on loops, so a searchless (floor-only) path always remains.
      const strict = reachableFrom(level, start, { secretsPassable: false });
      for (const tr of registry.getEntitiesWith('transition')) {
        const p = tr.components.get('position');
        expect(
          strict.has(`${p.x},${p.y}`),
          `${name} seed ${seed}: stair (${p.x},${p.y}) needs a search under 'redundant' scope`,
        ).toBe(true);
      }
    }
  });
});

describe.each(PIPELINES)('%s pipeline connectivity', (name, config) => {
  it('reaches every room and every stair from the arrival tile, across seeds', async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { level, registry } = await generate(config, seed);

      const start = arrivalTile(registry);
      expect(start, `${name} seed ${seed}: no arrival tile`).not.toBeNull();
      const reached = reachableFrom(level, start);

      const zones = level.blackboard['level:zones'] ?? [];
      const rooms = level.blackboard['level:rooms'] ?? {};
      for (const zone of zones) {
        const tile = centermostRoomTile(zone, rooms);
        if (!tile) continue;
        expect(
          reached.has(`${tile[0]},${tile[1]}`),
          `${name} seed ${seed}: zone ${zone.id} unreachable from arrival`,
        ).toBe(true);
      }

      for (const tr of registry.getEntitiesWith('transition')) {
        const pos = tr.components.get('position');
        expect(
          reached.has(`${pos.x},${pos.y}`),
          `${name} seed ${seed}: stair at (${pos.x},${pos.y}) unreachable from arrival`,
        ).toBe(true);
      }
    }
  });
});
