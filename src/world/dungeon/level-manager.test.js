import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../entities/components.js';
import { createStairs } from '../entities/furniture.js';
import { createLevel } from '../map/level.js';
import { createLevelManager } from './level-manager.js';

// Two floors wired up↔down. The runtime's job is topology (freeze/thaw/travel/arrive), not content, so
// we inject a trivial floor builder instead of running a shipped pipeline — that keeps these tests from
// breaking when pipeline content changes, and sidesteps the static pipelines' file:// import that
// vitest's resolver mangles on Windows. Each floor has an up-stair and a down-stair so both arrival
// ports resolve. Pipeline-based generation is covered by pipeline.test.js.
const TEST_MAP = {
  start: { node: 'a', port: 'up' },
  nodes: [
    { id: 'a', pipelineId: 'test-floor', branch: 0, depth: 0 },
    { id: 'b', pipelineId: 'test-floor', branch: 0, depth: 1 },
  ],
  edges: [{ a: ['a', 'down'], b: ['b', 'up'], dir: 'bidi' }],
};

// A minimal floor: a 10×10 room with an up-stair at (1,1) and a down-stair at (8,8).
function makeFloor(registry, node) {
  const level = createLevel({
    branch: node.branch,
    depth: node.depth,
    pipelineId: node.pipelineId,
  });
  level.width = 10;
  level.height = 10;
  level.tiles = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'floor'));
  level.placeEntity(createStairs(registry, 1, 1, 'up'));
  level.placeEntity(createStairs(registry, 8, 8, 'down'));
  return level;
}

function makePlayer(registry) {
  const player = registry.createEntity();
  registry.addComponent(player, 'name', components.name('Player'));
  registry.addComponent(player, 'position', components.position(0, 0));
  return player;
}

// Stands the player on the start level at the resolved arrival port, the way game-scene does.
async function startGame() {
  const registry = createEntityRegistry();
  const manager = createLevelManager({
    registry,
    transitMap: TEST_MAP,
    generateLevel: (node) => makeFloor(registry, node),
  });
  const { level } = await manager.start();
  const player = makePlayer(registry);
  level.placeEntity(player);
  return { registry, manager, level, player };
}

const stairPos = (registry, port) =>
  registry
    .getEntitiesWith('transition')
    .find((e) => e.components.get('transition').port === port)
    ?.components.get('position');

describe('LevelManager.travel', () => {
  it('descends to the next floor and lands the player on its up-stairs', async () => {
    const { registry, manager, player } = await startGame();

    const floorB = await manager.travel(player, 'down');

    expect(manager.getCurrentNodeId()).toBe('b');
    expect(floorB.depth).toBe(1);
    const up = stairPos(registry, 'up');
    expect(player.components.get('position')).toEqual({ x: up.x, y: up.y });
    expect(floorB.entities).toContain(player);
  });

  it('is a no-op for an unconnected port', async () => {
    const { manager, player } = await startGame();
    expect(await manager.travel(player, 'up')).toBeNull(); // floor-a top is unwired
    expect(manager.getCurrentNodeId()).toBe('a');
  });

  it('thaws a revisited floor from cold storage instead of regenerating it', async () => {
    const { registry, manager, level: floorA, player } = await startGame();

    // Leave a breadcrumb on floor A. If A were regenerated on return, it would be gone.
    const up = stairPos(registry, 'up');
    const breadcrumb = registry.createEntity();
    registry.addComponent(breadcrumb, 'name', components.name('Breadcrumb'));
    registry.addComponent(breadcrumb, 'position', components.position(up.x, up.y));
    floorA.placeEntity(breadcrumb);
    const breadcrumbId = breadcrumb.id;

    await manager.travel(player, 'down'); // A frozen with its breadcrumb
    const floorA2 = await manager.travel(player, 'up'); // back up — should thaw A

    expect(manager.getCurrentNodeId()).toBe('a');
    const restored = registry.getEntity(breadcrumbId);
    expect(restored).not.toBeNull();
    expect(floorA2.entities).toContain(restored);
    expect(restored.components.get('name')).toBe('Breadcrumb');

    // Arrival on return is the down-stairs (the stair you'd descend again).
    const down = stairPos(registry, 'down');
    expect(player.components.get('position')).toEqual({ x: down.x, y: down.y });
  });

  it('restores the player tile memory when returning to a frozen floor', async () => {
    const { registry, manager, player } = await startGame();
    const tp = components.tilePerception();
    tp.memory.set('1,1', 'floor');
    tp.rememberedEntities.set('1,1', [{ glyph: '+' }]);
    registry.addComponent(player, 'tilePerception', tp);

    await manager.travel(player, 'down'); // freezes A with the player's memory of it
    await manager.travel(player, 'up'); // thaws A — memory should come back

    const restored = player.components.get('tilePerception');
    expect(restored.memory.get('1,1')).toBe('floor');
    expect(restored.rememberedEntities.get('1,1')).toEqual([{ glyph: '+' }]);
  });

  it('starts a freshly generated floor with empty tile memory', async () => {
    const { registry, manager, player } = await startGame();
    const tp = components.tilePerception();
    tp.memory.set('1,1', 'floor');
    registry.addComponent(player, 'tilePerception', tp);

    await manager.travel(player, 'down'); // B has never been visited

    expect(player.components.get('tilePerception').memory.size).toBe(0);
    expect(player.components.get('tilePerception').rememberedEntities.size).toBe(0);
  });

  it('includes the player tile memory in the frozen floor snapshot (JSON-safe)', async () => {
    const { registry, manager, player } = await startGame();
    const tp = components.tilePerception();
    tp.memory.set('2,2', 'wall');
    registry.addComponent(player, 'tilePerception', tp);

    await manager.travel(player, 'down'); // A frozen
    const snap = manager.snapshot();

    expect(snap.frozenLevels.a.playerMemory.memory).toEqual([['2,2', 'wall']]);
  });

  it('restores frozen player memory across a reload (snapshot -> restore)', async () => {
    const { registry, manager, player } = await startGame();
    const tp = components.tilePerception();
    tp.memory.set('3,3', 'floor');
    registry.addComponent(player, 'tilePerception', tp);
    await manager.travel(player, 'down'); // A frozen
    const saved = JSON.parse(JSON.stringify(manager.snapshot()));

    // Fresh runtime restoring from the save, currently standing on B.
    const manager2 = createLevelManager({ registry, transitMap: TEST_MAP });
    manager2.restore({
      currentNodeId: 'b',
      level: manager.getCurrentLevel(),
      frozenLevels: saved.frozenLevels,
    });
    await manager2.travel(player, 'up'); // thaw A from the restored blob

    expect(player.components.get('tilePerception').memory.get('3,3')).toBe('floor');
  });

  it('builds each floor from its transit-map node identity', async () => {
    const seen = [];
    const registry = createEntityRegistry();
    const manager = createLevelManager({
      registry,
      transitMap: TEST_MAP,
      generateLevel: (node) => {
        seen.push(`${node.branch}:${node.depth}`);
        return makeFloor(registry, node);
      },
    });
    const { level } = await manager.start(); // builds 'a'
    const player = makePlayer(registry);
    level.placeEntity(player);
    await manager.travel(player, 'down'); // builds 'b'

    expect(seen).toEqual(['0:0', '0:1']); // the manager passes each node's (branch, depth)
  });
});
