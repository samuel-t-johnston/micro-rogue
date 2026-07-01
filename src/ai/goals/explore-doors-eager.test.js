import { describe, it, expect } from 'vitest';
import { exploreDoorsEager } from './explore-doors-eager.js';
import { createLevel } from '../../world/map/level.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../../world/entities/components.js';

function openLevel(w = 12, h = 12) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

// Places a door entity on the level and returns it. A closed door blocks movement (so pathfinding
// approaches it rather than routing onto it), matching how the game toggles the component.
function placeDoor(level, registry, x, y, isOpen) {
  const door = registry.createEntity();
  registry.addComponent(door, 'position', components.position(x, y));
  const openable = components.openable('door-closed', 'door-open');
  openable.isOpen = isOpen;
  registry.addComponent(door, 'openable', openable);
  if (!isOpen) registry.addComponent(door, 'blocksMovement', components.blocksMovement());
  level.placeEntity(door);
  return door;
}

// An observation as the vision sense would report a door.
function doorObs(door, x, y, isOpen) {
  return {
    entityId: door.id,
    position: { x, y },
    tags: { isPlayer: false, isActor: false, isOpenable: true },
    isOpen,
  };
}

function ctx(memory, { level = openLevel(), x = 5, y = 5, turnCount = 1, entities = [] } = {}) {
  return { memory, selfState: { position: { x, y } }, level, perception: { entities }, turnCount };
}

describe('explore-doors-eager', () => {
  it('does nothing with no target, no visible doors, and no explored tiles', () => {
    expect(exploreDoorsEager.evaluate(ctx({}))).toBeNull();
  });

  it('acquires the nearest visible closed door and approaches it', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const near = placeDoor(level, registry, 8, 5, false);
    placeDoor(level, registry, 5, 10, false); // farther away
    const memory = {};
    const nearObs = doorObs(near, 8, 5, false);
    const farObs = doorObs({ id: 999 }, 5, 10, false);

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, entities: [farObs, nearObs] }));

    expect(memory.exploreDoors.targetId).toBe(near.id);
    // Approaches a tile beside the door at x=8 (does not route onto the closed door) — first step east.
    expect(result.action).toMatchObject({ type: 'move', x: 6 });
  });

  it('ignores open doors when acquiring a target', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const open = placeDoor(level, registry, 8, 5, true);
    const memory = {};
    const result = exploreDoorsEager.evaluate(
      ctx(memory, { level, entities: [doorObs(open, 8, 5, true)] }),
    );
    expect(memory.exploreDoors.targetId).toBeUndefined();
    expect(result).toBeNull();
  });

  it('opens a closed target door when adjacent', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 6, 5, false);
    const memory = { exploreDoors: { targetId: door.id, targetPos: { x: 6, y: 5 }, explored: [] } };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5 }));
    expect(result.action).toEqual({ type: 'interact', targetEntityId: door.id });
  });

  it('marks its side and steps onto an adjacent open door', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 6, 5, true);
    const memory = { exploreDoors: { targetId: door.id, targetPos: { x: 6, y: 5 }, explored: [] } };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5, turnCount: 3 }));
    expect(result.action).toEqual({ type: 'move', x: 6, y: 5 });
    expect(memory.exploreDoors.explored).toContainEqual({ x: 5, y: 5, turn: 3 });
  });

  it('holds (keeps target, marks nothing) when the open door is occupied', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 6, 5, true);
    // A creature standing on the open door blocks the tile.
    const blocker = registry.createEntity();
    registry.addComponent(blocker, 'position', components.position(6, 5));
    registry.addComponent(blocker, 'blocksMovement', components.blocksMovement());
    level.placeEntity(blocker);
    const memory = { exploreDoors: { targetId: door.id, targetPos: { x: 6, y: 5 }, explored: [] } };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5, turnCount: 3 }));
    expect(result).toBeNull();
    expect(memory.exploreDoors.targetId).toBe(door.id); // keeps the doorway
    expect(memory.exploreDoors.explored).toHaveLength(0); // marked nothing
  });

  it('steps through and off an open door it stands on, retiring the target', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 5, 5, true);
    const memory = {
      exploreDoors: {
        targetId: door.id,
        targetPos: { x: 5, y: 5 },
        explored: [{ x: 4, y: 5, turn: 2 }], // the near side we came from
      },
    };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5, turnCount: 3 }));
    // Moves east, away from the explored near-side tile (x=4) and off the door.
    expect(result.action).toMatchObject({ type: 'move', x: 6 });
    expect(memory.exploreDoors.targetId).toBeUndefined();
    expect(memory.exploreDoors.explored).toContainEqual({ x: 5, y: 5, turn: 3 });
  });

  it('gives up on an unreachable closed target door', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 8, 5, false);
    // Wall the door off completely.
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      level.tiles[5 + dy][8 + dx] = 'wall';
    }
    const memory = { exploreDoors: { targetId: door.id, targetPos: { x: 8, y: 5 }, explored: [] } };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 2, y: 5 }));
    expect(result).toBeNull();
    expect(memory.exploreDoors.targetId).toBeUndefined();
  });

  it('abandons a target door opened by something else while detached', () => {
    const level = openLevel();
    const registry = createEntityRegistry();
    const door = placeDoor(level, registry, 9, 5, true); // now open, and far from us
    const memory = { exploreDoors: { targetId: door.id, targetPos: { x: 9, y: 5 }, explored: [] } };

    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 2, y: 5 }));
    expect(result).toBeNull();
    expect(memory.exploreDoors.targetId).toBeUndefined();
  });

  it('clears a target whose door entity no longer exists', () => {
    const level = openLevel();
    const memory = { exploreDoors: { targetId: 42, targetPos: { x: 6, y: 5 }, explored: [] } };
    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5 }));
    expect(memory.exploreDoors.targetId).toBeUndefined();
    expect(result).toBeNull();
  });

  it('forgets explored tiles older than the TTL', () => {
    const level = openLevel();
    const memory = { exploreDoors: { explored: [{ x: 4, y: 5, turn: 1 }] } };
    exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5, turnCount: 99 }));
    expect(memory.exploreDoors.explored).toHaveLength(0);
  });

  it('drifts away from recently explored tiles when it has no door to chase', () => {
    const level = openLevel();
    const memory = { exploreDoors: { explored: [{ x: 4, y: 5, turn: 1 }] } };
    const result = exploreDoorsEager.evaluate(ctx(memory, { level, x: 5, y: 5, turnCount: 2 }));
    // Away from x=4 means increasing x.
    expect(result.action).toMatchObject({ type: 'move', x: 6 });
  });
});
