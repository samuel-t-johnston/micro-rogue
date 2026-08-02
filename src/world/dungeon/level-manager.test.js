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

  // A two-floor map whose floor 'a' opts into total-reset regeneration on return.
  const REGEN_MAP = {
    start: { node: 'a', port: 'up' },
    nodes: [
      { id: 'a', pipelineId: 'test-floor', branch: 0, depth: 0, reentry: 'regen' },
      { id: 'b', pipelineId: 'test-floor', branch: 0, depth: 1 },
    ],
    edges: [{ a: ['a', 'down'], b: ['b', 'up'], dir: 'bidi' }],
  };

  // Starts a game on REGEN_MAP with a generateLevel seam that records the (node, epoch) of each build.
  async function startRegenGame() {
    const epochs = [];
    const registry = createEntityRegistry();
    const manager = createLevelManager({
      registry,
      transitMap: REGEN_MAP,
      generateLevel: (node, epoch) => {
        epochs.push(`${node.id}:${epoch}`);
        return makeFloor(registry, node);
      },
    });
    const { level } = await manager.start();
    const player = makePlayer(registry);
    level.placeEntity(player);
    return { registry, manager, level, player, epochs };
  }

  it('regenerates a revisited floor when its node opts into reentry: regen', async () => {
    const { registry, manager, level: floorA, player, epochs } = await startRegenGame();

    // A breadcrumb that a thaw would restore. A regen rebuilds the floor, so it must be gone.
    const up = stairPos(registry, 'up');
    const breadcrumb = registry.createEntity();
    registry.addComponent(breadcrumb, 'name', components.name('Breadcrumb'));
    registry.addComponent(breadcrumb, 'position', components.position(up.x, up.y));
    floorA.placeEntity(breadcrumb);
    const breadcrumbId = breadcrumb.id;

    await manager.travel(player, 'down'); // to B (freezes A with its breadcrumb)
    const floorA2 = await manager.travel(player, 'up'); // back to A — regenerates, not thaws

    expect(manager.getCurrentNodeId()).toBe('a');
    expect(registry.getEntity(breadcrumbId)).toBeNull(); // not restored: the floor was rebuilt
    expect(floorA2.entities).not.toContain(breadcrumb);
    expect(epochs).toEqual(['a:0', 'b:0', 'a:1']); // A first built at epoch 0, rebuilt at epoch 1
  });

  it('increments the epoch on each successive regeneration of the same floor', async () => {
    const { manager, player, epochs } = await startRegenGame();
    await manager.travel(player, 'down'); // A frozen (epoch 0)
    await manager.travel(player, 'up'); // A regenerated at epoch 1
    await manager.travel(player, 'down'); // A frozen (epoch 1)
    await manager.travel(player, 'up'); // A regenerated at epoch 2
    expect(epochs).toEqual(['a:0', 'b:0', 'a:1', 'a:2']);
  });

  it('arrives in the dark on a regen — stale layout memory is not restored', async () => {
    const { registry, manager, player } = await startRegenGame();
    const tp = components.tilePerception();
    tp.memory.set('1,1', 'floor');
    registry.addComponent(player, 'tilePerception', tp);

    await manager.travel(player, 'down'); // freezes A's remembered tiles
    await manager.travel(player, 'up'); // regen — memory of the old layout is meaningless

    expect(player.components.get('tilePerception').memory.size).toBe(0);
  });

  // Builds a floor-mapped quest item (questItem + item + position) and drops it on `level`.
  function placeQuestItem(registry, level, x, y, questId) {
    const q = registry.createEntity();
    registry.addComponent(q, 'name', components.name(`Quest ${questId}`));
    registry.addComponent(q, 'item', components.item({ type: 'map' }));
    registry.addComponent(q, 'questItem', components.questItem(questId));
    registry.addComponent(q, 'position', components.position(x, y));
    level.placeEntity(q);
    return q;
  }

  it('carries a floor quest item across a regen, onto the arrival tile', async () => {
    const { registry, manager, level: floorA, player } = await startRegenGame();
    const amulet = placeQuestItem(registry, floorA, 1, 1, 'amulet');
    const amuletId = amulet.id;

    // A plain, non-quest entity that the total reset must destroy.
    const breadcrumb = registry.createEntity();
    registry.addComponent(breadcrumb, 'name', components.name('Breadcrumb'));
    registry.addComponent(breadcrumb, 'position', components.position(1, 1));
    floorA.placeEntity(breadcrumb);
    const breadcrumbId = breadcrumb.id;

    await manager.travel(player, 'down');
    const floorA2 = await manager.travel(player, 'up'); // regen

    const survived = registry.getEntity(amuletId);
    const arrival = player.components.get('position');
    expect(survived).not.toBeNull();
    expect(survived.components.has('questItem')).toBe(true);
    expect(survived.components.get('position')).toEqual({ x: arrival.x, y: arrival.y });
    expect(survived.components.get('item').location).toEqual({ type: 'map' });
    expect([...floorA2.getEntitiesAt(arrival.x, arrival.y)]).toContain(survived);
    expect(registry.getEntity(breadcrumbId)).toBeNull(); // the reset was total for everything else
  });

  it('carries a quest item out of a chest, dropping the chest itself', async () => {
    const { registry, manager, level: floorA, player } = await startRegenGame();
    const chest = registry.createEntity();
    registry.addComponent(chest, 'position', components.position(5, 5));
    registry.addComponent(chest, 'container', components.container());
    registry.addComponent(chest, 'inventory', components.inventory());
    const amulet = registry.createEntity();
    registry.addComponent(amulet, 'name', components.name('Amulet'));
    registry.addComponent(
      amulet,
      'item',
      components.item({ type: 'container', containerId: chest.id }),
    );
    registry.addComponent(amulet, 'questItem', components.questItem('amulet'));
    chest.components.get('inventory').items.push(amulet);
    floorA.placeEntity(chest);
    const amuletId = amulet.id;
    const chestId = chest.id;

    await manager.travel(player, 'down');
    await manager.travel(player, 'up'); // regen

    const survived = registry.getEntity(amuletId);
    const arrival = player.components.get('position');
    expect(survived).not.toBeNull();
    expect(survived.components.get('item').location).toEqual({ type: 'map' }); // now on the floor
    expect(survived.components.get('position')).toEqual({ x: arrival.x, y: arrival.y });
    expect(registry.getEntity(chestId)).toBeNull(); // the container is destroyed with everything else
  });

  it('preserves the carried quest item’s own state and contents (the real entity, not a fresh one)', async () => {
    const { registry, manager, level: floorA, player } = await startRegenGame();
    const relic = placeQuestItem(registry, floorA, 3, 3, 'relic'); // name: 'Quest relic'
    registry.addComponent(relic, 'inventory', components.inventory());
    const charge = registry.createEntity();
    registry.addComponent(charge, 'name', components.name('Charge'));
    relic.components.get('inventory').items.push(charge);
    const relicId = relic.id;
    const chargeId = charge.id;

    await manager.travel(player, 'down');
    await manager.travel(player, 'up'); // regen

    const survived = registry.getEntity(relicId);
    expect(survived.components.get('name')).toBe('Quest relic'); // same entity, state intact
    const contents = survived.components.get('inventory').items;
    expect(contents).toHaveLength(1);
    expect(contents[0].id).toBe(chargeId); // its nested contents rode along
    expect(contents[0].components.get('name')).toBe('Charge');
  });

  it('stacks multiple carried quest items on the one arrival tile', async () => {
    const { registry, manager, level: floorA, player } = await startRegenGame();
    const ids = [0, 1, 2].map((i) => placeQuestItem(registry, floorA, 2 + i, 2, `q${i}`).id);

    await manager.travel(player, 'down');
    const floorA2 = await manager.travel(player, 'up'); // regen

    const arrival = player.components.get('position');
    const here = [...floorA2.getEntitiesAt(arrival.x, arrival.y)];
    for (const id of ids) {
      const e = registry.getEntity(id);
      expect(e).not.toBeNull();
      expect(e.components.get('position')).toEqual({ x: arrival.x, y: arrival.y });
      expect(here).toContain(e);
    }
  });

  it('stamps the freeze turn onto the frozen floor snapshot', async () => {
    const { manager, player } = await startGame();
    await manager.travel(player, 'down', 42); // freeze floor A at turn 42
    expect(manager.snapshot().frozenLevels.a.frozenAtTurn).toBe(42);
  });

  it('defaults the freeze turn to 0 when no turn count is supplied', async () => {
    const { manager, player } = await startGame();
    await manager.travel(player, 'down'); // no turn arg (older callers / tests)
    expect(manager.snapshot().frozenLevels.a.frozenAtTurn).toBe(0);
  });

  it('lands on the matching entrance when two branches reconverge on one floor', async () => {
    // Diamond: floor 'c' is reachable both directly (a→c) and via a branch (a→b→c), each arriving at
    // its own up-stair. This is the multi-entrance case — distinct ports, not distinct directions.
    const MAP = {
      start: { node: 'a', port: 'up' },
      nodes: [
        { id: 'a', pipelineId: 'f', branch: 0, depth: 0 },
        { id: 'b', pipelineId: 'f', branch: 1, depth: 0 },
        { id: 'c', pipelineId: 'f', branch: 0, depth: 1 },
      ],
      edges: [
        { a: ['a', 'down'], b: ['c', 'up'], dir: 'bidi' }, // main descent → c's 'up' entrance
        { a: ['a', 'branch'], b: ['b', 'up'], dir: 'bidi' }, // side branch a → b
        { a: ['b', 'down'], b: ['c', 'up2'], dir: 'bidi' }, // b rejoins c at its 'up2' entrance
      ],
    };
    // Stairs each floor exposes: [x, y, direction, port]. Floor c has two up-stairs (two entrances).
    const STAIRS = {
      a: [
        [1, 1, 'up', 'up'],
        [8, 8, 'down', 'down'],
        [8, 1, 'down', 'branch'],
      ],
      b: [
        [1, 1, 'up', 'up'],
        [8, 8, 'down', 'down'],
      ],
      c: [
        [1, 1, 'up', 'up'],
        [8, 1, 'up', 'up2'],
        [8, 8, 'down', 'down'],
      ],
    };
    const build = (registry, node) => {
      const level = createLevel({
        branch: node.branch,
        depth: node.depth,
        pipelineId: node.pipelineId,
      });
      level.width = 10;
      level.height = 10;
      level.tiles = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'floor'));
      for (const [x, y, dir, port] of STAIRS[node.id])
        level.placeEntity(createStairs(registry, x, y, dir, null, port));
      return level;
    };
    const start = async () => {
      const registry = createEntityRegistry();
      const manager = createLevelManager({
        registry,
        transitMap: MAP,
        generateLevel: (n) => build(registry, n),
      });
      const { level } = await manager.start();
      const player = makePlayer(registry);
      level.placeEntity(player);
      return { manager, player };
    };

    const direct = await start();
    await direct.manager.travel(direct.player, 'down'); // a → c
    expect(direct.manager.getCurrentNodeId()).toBe('c');
    expect(direct.player.components.get('position')).toEqual({ x: 1, y: 1 }); // c's 'up' entrance

    const viaBranch = await start();
    await viaBranch.manager.travel(viaBranch.player, 'branch'); // a → b
    await viaBranch.manager.travel(viaBranch.player, 'down'); // b → c
    expect(viaBranch.manager.getCurrentNodeId()).toBe('c');
    expect(viaBranch.player.components.get('position')).toEqual({ x: 8, y: 1 }); // c's 'up2' entrance
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
