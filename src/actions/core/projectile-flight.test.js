import { describe, it, expect, beforeEach } from 'vitest';
import { traceFlight, settleProjectile, scatterTile } from './projectile-flight.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { components } from '../../world/entities/components.js';
import { rng } from '../../engine/core/rng.js';

function makeLevel() {
  const level = createLevel();
  level.width = 6;
  level.height = 6;
  level.tiles = Array.from({ length: 6 }, () => Array(6).fill('floor'));
  return level;
}

describe('traceFlight', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  function makeBlocker(x, y) {
    const e = registry.createEntity();
    registry.addComponent(e, 'position', components.position(x, y));
    registry.addComponent(e, 'blocksMovement', components.blocksMovement());
    level.placeEntity(e);
    return e;
  }

  it('reaches the target when the line is clear', () => {
    // A clear line walks `before` all the way up to the target, so it coincides with `impact`; the
    // fallback is only consulted when the impact tile cannot hold the item.
    const { impact, before } = traceFlight(level, 2, 2, 4, 2);
    expect(impact).toEqual({ x: 4, y: 2 });
    expect(before).toEqual({ x: 4, y: 2 });
  });

  it('stops at a wall, keeping the last clear tile as the fallback', () => {
    level.tiles[2][3] = 'wall';
    const { impact, before } = traceFlight(level, 2, 2, 4, 2);
    expect(impact).toEqual({ x: 3, y: 2 });
    expect(before).toEqual({ x: 2, y: 2 });
  });

  it('stops at a blocking entity along the path', () => {
    makeBlocker(3, 2);
    const { impact, before } = traceFlight(level, 2, 2, 4, 2);
    expect(impact).toEqual({ x: 3, y: 2 });
    expect(before).toEqual({ x: 2, y: 2 });
  });

  it('falls back to the origin when the first step is blocked', () => {
    makeBlocker(3, 2);
    const { impact, before } = traceFlight(level, 2, 2, 3, 2);
    expect(impact).toEqual({ x: 3, y: 2 });
    expect(before).toEqual({ x: 2, y: 2 });
  });
});

describe('scatterTile', () => {
  let level;

  beforeEach(() => {
    rng.init(7);
    level = makeLevel();
  });

  // Shooter due west of the target: the shot travels E, so the three "behind" tiles are E/SE/NE of
  // the target. from (0,2) → target (3,2).
  const behind = [
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 4, y: 1 },
  ];
  const allowed = [
    { x: 3, y: 3 }, // S
    { x: 2, y: 3 }, // SW
    { x: 2, y: 2 }, // W
    { x: 2, y: 1 }, // NW
    { x: 3, y: 1 }, // N
  ];

  it('only ever redirects to a side/front tile, never one directly behind the target', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const t = scatterTile(level, { x: 0, y: 2 }, { x: 3, y: 2 });
      seen.add(`${t.x},${t.y}`);
      expect(allowed).toContainEqual(t);
      expect(behind).not.toContainEqual(t);
    }
    expect(seen.size).toBeGreaterThan(1); // it does vary across the allowed set
  });

  it('excludes walls and solid fixtures from the candidates', () => {
    for (const t of allowed) if (!(t.x === 2 && t.y === 2)) level.tiles[t.y][t.x] = 'wall';
    // Only the W tile (2,2) is left open, so it is the sole possible landing spot.
    expect(scatterTile(level, { x: 0, y: 2 }, { x: 3, y: 2 })).toEqual({ x: 2, y: 2 });
  });

  it('returns null when every candidate tile is blocked (a cornered target just gets hit)', () => {
    for (const t of allowed) level.tiles[t.y][t.x] = 'wall';
    expect(scatterTile(level, { x: 0, y: 2 }, { x: 3, y: 2 })).toBeNull();
  });

  it('returns null when the shooter and target coincide', () => {
    expect(scatterTile(level, { x: 2, y: 2 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe('settleProjectile', () => {
  let registry, level;

  beforeEach(() => {
    rng.init(123);
    registry = createEntityRegistry();
    level = makeLevel();
  });

  function makeItem() {
    const e = registry.createEntity();
    registry.addComponent(e, 'item', components.item({ type: 'inventory', ownerId: 0 }));
    return e;
  }

  it('destroys the item and reports a break when breakChance is 1', () => {
    const item = makeItem();
    const broke = settleProjectile(
      item,
      { impact: { x: 4, y: 4 }, before: { x: 3, y: 4 }, breakChance: 1 },
      level,
      registry,
    );
    expect(broke).toBe(true);
    expect(registry.getEntity(item.id)).toBeNull();
  });

  it('lands the item on the impact tile when it does not break', () => {
    const item = makeItem();
    const broke = settleProjectile(
      item,
      { impact: { x: 4, y: 4 }, before: { x: 3, y: 4 }, breakChance: 0 },
      level,
      registry,
    );
    expect(broke).toBe(false);
    expect(item.components.get('item').location).toEqual({ type: 'map' });
    expect(item.components.get('position')).toEqual({ x: 4, y: 4 });
    expect([...level.getEntitiesAt(4, 4)]).toContain(item);
  });

  it('bounces back to the last clear tile when the impact tile cannot hold the item', () => {
    level.tiles[4][4] = 'wall'; // impact tile is solid
    const item = makeItem();
    settleProjectile(
      item,
      { impact: { x: 4, y: 4 }, before: { x: 3, y: 4 }, breakChance: 0 },
      level,
      registry,
    );
    expect(item.components.get('position')).toEqual({ x: 3, y: 4 });
  });

  it('skips the break roll entirely when breakChance is null (RNG sequence untouched)', () => {
    // A breakChance of 0 still consumes one RNG draw; null must not. Compare the next gameplay draw
    // after each from the same seed — they differ iff the null path skipped the draw.
    settleProjectile(
      makeItem(),
      { impact: { x: 4, y: 4 }, before: { x: 3, y: 4 }, breakChance: 0 },
      level,
      registry,
    );
    const afterZeroRoll = rng.random();

    rng.init(123);
    const broke = settleProjectile(
      makeItem(),
      { impact: { x: 5, y: 4 }, before: { x: 4, y: 4 }, breakChance: null },
      level,
      registry,
    );
    const afterNullRoll = rng.random();

    expect(broke).toBe(false);
    expect(afterNullRoll).not.toBe(afterZeroRoll);
  });
});
