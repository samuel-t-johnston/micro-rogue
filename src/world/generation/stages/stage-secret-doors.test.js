import { describe, it, expect } from 'vitest';
import { run as runSecretDoors, wantSecret } from './stage-secret-doors.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createDoor } from '../../entities/furniture.js';
import { createRng } from '../../../engine/core/rng.js';
import { isFloorTile, tileCategory } from '../../map/tile-registry.js';

// Builds a level from an ASCII map. '#' wall, '.' floor, 'D' a floor tile carrying a closed door.
function build(rows) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map((r) => [...r].map((c) => (c === '#' ? 'wall' : 'floor')));
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === 'D') level.placeEntity(createDoor(registry, x, y));
    }),
  );
  return { level, registry };
}

const secretsOf = (registry) => registry.getEntitiesWith('secret');
const doorsOf = (level) => level.entities.filter((e) => e.components.get('openable'));

// Flood over floor terrain only (secrets, being wall, are impassable) — the "searchless" reachability.
function floorConnected(level, from, to) {
  const W = level.width;
  const seen = new Set([from[1] * W + from[0]]);
  const stack = [from];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = (y + dy) * W + (x + dx);
      if (!seen.has(k) && isFloorTile(level.tiles[y + dy]?.[x + dx])) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return false;
}

// Two rooms (columns x1 and x5) joined by a top and a bottom corridor, a door in each — so both doors
// sit on a loop (each is individually redundant).
const LOOP = ['#######', '#..D..#', '#.###.#', '#..D..#', '#######'];

// Two rooms joined by a single corridor with one door — that door is the sole path (not redundant).
const SOLE = ['#####', '#.D.#', '#####'];

describe('wantSecret', () => {
  const hit = { random: () => 0 };
  const miss = { random: () => 0.99 };
  const boom = {
    random: () => {
      throw new Error('rng must not be drawn');
    },
  };

  it('skips a sole-access door under "redundant" scope without drawing', () => {
    expect(wantSecret(false, 'redundant', 1, boom)).toBe(false);
  });
  it('rolls a redundant door under "redundant" scope', () => {
    expect(wantSecret(true, 'redundant', 1, hit)).toBe(true);
    expect(wantSecret(true, 'redundant', 0.5, miss)).toBe(false);
  });
  it('rolls any door under "all" scope', () => {
    expect(wantSecret(false, 'all', 1, hit)).toBe(true);
    expect(wantSecret(false, 'all', 0.5, miss)).toBe(false);
  });
});

describe('secret-doors stage', () => {
  it('is a no-op at chance 0, never touching doors or the rng', () => {
    const { level, registry } = build(LOOP);
    const boom = {
      random: () => {
        throw new Error('rng must not be drawn');
      },
    };
    runSecretDoors(level, { chance: 0 }, level.blackboard, boom, registry);
    expect(secretsOf(registry)).toHaveLength(0);
    expect(doorsOf(level)).toHaveLength(2);
  });

  it('under "redundant" scope, converts loop doors but keeps a searchless path', () => {
    const { level, registry } = build(LOOP);
    runSecretDoors(
      level,
      { chance: 1, scope: 'redundant' },
      level.blackboard,
      createRng(1),
      registry,
    );

    // Both doors are on the loop, but sealing both would cut the rooms apart with no non-secret path,
    // so the sequential redundancy rule converts exactly one and leaves the other a normal door.
    expect(secretsOf(registry)).toHaveLength(1);
    expect(doorsOf(level)).toHaveLength(1);
    // The two rooms stay connected over floor alone (no search needed).
    expect(floorConnected(level, [1, 1], [5, 1])).toBe(true);
  });

  it('under "all" scope, converts a sole-access door (search-gating a room)', () => {
    const { level, registry } = build(SOLE);
    runSecretDoors(level, { chance: 1, scope: 'all' }, level.blackboard, createRng(1), registry);

    expect(secretsOf(registry)).toHaveLength(1);
    // Sealed: the far room is no longer reachable over floor alone — only by searching.
    expect(floorConnected(level, [1, 1], [3, 1])).toBe(false);
  });

  it('under "redundant" scope, never converts a sole-access door', () => {
    const { level, registry } = build(SOLE);
    runSecretDoors(
      level,
      { chance: 1, scope: 'redundant' },
      level.blackboard,
      createRng(1),
      registry,
    );
    expect(secretsOf(registry)).toHaveLength(0);
    expect(doorsOf(level)).toHaveLength(1);
  });

  it('a converted door becomes wall terrain with a dormant secret that reveals to the old floor', () => {
    const { level, registry } = build(SOLE); // door at (2,1) on 'floor'
    runSecretDoors(level, { chance: 1, scope: 'all' }, level.blackboard, createRng(1), registry);

    const secret = secretsOf(registry)[0];
    const pos = secret.components.get('position');
    expect(tileCategory(level.getTile(pos.x, pos.y))).toBe('wall');
    expect(secret.components.get('entityTypeId')).toBe('secretDoor');
    expect(secret.components.get('secret').revealFloor).toBe('floor');
    expect(doorsOf(level)).toHaveLength(0); // the original door entity is gone
  });

  it('bounds restricts conversion to doors inside the rect', () => {
    // Two independent sole-access doors; bounds covers only the left one.
    const { level, registry } = build(['#########', '#.D.#.D.#', '#########']);
    runSecretDoors(
      level,
      { chance: 1, scope: 'all', bounds: { x: 0, y: 0, w: 4, h: 3 } },
      level.blackboard,
      createRng(1),
      registry,
    );
    const secrets = secretsOf(registry);
    expect(secrets).toHaveLength(1);
    expect(secrets[0].components.get('position').x).toBe(2); // left door only
  });

  it('is deterministic for a given seed', () => {
    const positions = () => {
      const { level, registry } = build(LOOP);
      runSecretDoors(
        level,
        { chance: 0.5, scope: 'all' },
        level.blackboard,
        createRng(7),
        registry,
      );
      return secretsOf(registry)
        .map((s) => {
          const p = s.components.get('position');
          return `${p.x},${p.y}`;
        })
        .sort();
    };
    expect(positions()).toEqual(positions());
  });
});
