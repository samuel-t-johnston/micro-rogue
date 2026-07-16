import { describe, it, expect } from 'vitest';
import { run as bspGeometry } from './stage-bsp-geometry.js';
import { run as bspCarve } from './stage-bsp-carve.js';
import { LEVEL_BSP, LEVEL_ROOMS } from '../blackboard-keys.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createRng } from '../../../engine/core/rng.js';

// Runs geometry then carve on a fresh level, sharing one rng+blackboard, and returns the pieces tests
// poke at. `carveConfig` tunes the carve stage (door params); `geoConfig` the partition.
function build(geoConfig, carveConfig = {}, seed = 1) {
  const rng = createRng(seed);
  const registry = createEntityRegistry();
  const level = createLevel();
  bspGeometry(level, geoConfig, level.blackboard, rng);
  bspCarve(level, carveConfig, level.blackboard, rng, registry);
  return { level, registry };
}

// All floor tiles reachable from the first floor tile by 4-way steps over floor. Exits carve floor
// through the shared walls, so a fully-connected layout reaches every floor tile.
function connectedFloorCount(level) {
  const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';
  let start = null;
  for (let y = 0; y < level.height && !start; y++)
    for (let x = 0; x < level.width; x++)
      if (isFloor(x, y)) {
        start = [x, y];
        break;
      }
  if (!start) return 0;
  const seen = new Set([`${start[0]},${start[1]}`]);
  const stack = [start];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      const k = `${nx},${ny}`;
      if (isFloor(nx, ny) && !seen.has(k)) {
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
  }
  return seen.size;
}

function totalFloor(level) {
  let n = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) if (level.tiles[y][x] === 'floor') n++;
  return n;
}

const doors = (level) => level.entities.filter((e) => e.components.get('entityTypeId') === 'door');

describe('stage-bsp-carve', () => {
  it('sizes the level to the plan bounds and fills it with only floor and wall', () => {
    const { level } = build({ width: 40, height: 30 });
    expect(level.width).toBe(40);
    expect(level.height).toBe(30);
    for (let y = 0; y < level.height; y++)
      for (let x = 0; x < level.width; x++) expect(['floor', 'wall']).toContain(level.tiles[y][x]);
  });

  it('leaves the entire map floor-connected through the carved exits', () => {
    const { level } = build({ width: 48, height: 32 }, {}, 4);
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
  });

  it('wraps the map in a solid wall border', () => {
    const { level } = build({ width: 40, height: 30 });
    for (let x = 0; x < level.width; x++) {
      expect(level.tiles[0][x]).toBe('wall');
      expect(level.tiles[level.height - 1][x]).toBe('wall');
    }
    for (let y = 0; y < level.height; y++) {
      expect(level.tiles[y][0]).toBe('wall');
      expect(level.tiles[y][level.width - 1]).toBe('wall');
    }
  });

  it('floors every room interior and carves each connection gap', () => {
    const { level } = build({ width: 44, height: 34 }, {}, 6);
    for (const room of Object.values(level.blackboard[LEVEL_ROOMS])) {
      for (let y = room.y0; y <= room.y1; y++)
        for (let x = room.x0; x <= room.x1; x++) expect(level.tiles[y][x]).toBe('floor');
    }
    for (const c of level.blackboard[LEVEL_BSP].connections) {
      for (const [x, y] of c.tiles) expect(level.tiles[y][x]).toBe('floor');
    }
  });

  it('doors every room exit by default and places them on the connection gaps', () => {
    const { level } = build({ width: 44, height: 34 }, {}, 6);
    const eligible = level.blackboard[LEVEL_BSP].connections.filter((c) => c.door);
    const placed = doors(level);
    expect(placed.length).toBe(eligible.length);
    const gapKeys = new Set(eligible.map((c) => `${c.gap[0]},${c.gap[1]}`));
    for (const d of placed) {
      const p = d.components.get('position');
      expect(gapKeys.has(`${p.x},${p.y}`)).toBe(true);
    }
  });

  it("places no doors when present is 'none'", () => {
    const { level } = build({ width: 44, height: 34 }, { doors: { present: 'none' } }, 6);
    expect(doors(level)).toHaveLength(0);
  });

  it("spawns doors open when open is 'all'", () => {
    const { level } = build(
      { width: 44, height: 34 },
      { doors: { present: 'all', open: 'all' } },
      6,
    );
    const placed = doors(level);
    expect(placed.length).toBeGreaterThan(0);
    for (const d of placed) {
      expect(d.components.get('openable').isOpen).toBe(true);
      expect(d.components.has('blocksMovement')).toBe(false);
    }
  });

  it('carves into an existing level in place, leaving its border wall untouched (embedded)', () => {
    const rng = createRng(3);
    const registry = createEntityRegistry();
    const level = createLevel();
    // An enclosing box: a wall ring around an all-floor interior.
    level.width = 30;
    level.height = 24;
    level.tiles = Array.from({ length: 24 }, (_, y) =>
      Array.from({ length: 30 }, (_, x) =>
        x === 0 || y === 0 || x === 29 || y === 23 ? 'wall' : 'floor',
      ),
    );
    const bounds = { x: 0, y: 0, w: 30, h: 24 };
    bspGeometry(level, { bounds }, level.blackboard, rng);
    // Sabotage: mark the border so we can prove carve with outerWall:false doesn't repaint it.
    level.blackboard[LEVEL_BSP].outerWall = false;
    level.tiles[0][5] = 'sentinel';
    bspCarve(level, {}, level.blackboard, rng, registry);

    expect(level.width).toBe(30); // not re-sized
    expect(level.tiles[0][5]).toBe('sentinel'); // border tile left alone
    // interior still gets partitioned into rooms + walls
    expect(totalFloor(level)).toBeGreaterThan(0);
  });

  it('every connection gap is a straight doorway (floor on two opposite sides, never a corner)', () => {
    const { level } = build({ width: 48, height: 32 }, {}, 4);
    const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';
    for (const c of level.blackboard[LEVEL_BSP].connections) {
      const [x, y] = c.gap;
      const horiz = isFloor(x - 1, y) && isFloor(x + 1, y);
      const vert = isFloor(x, y - 1) && isFloor(x, y + 1);
      // exactly one axis passes through (opposite neighbours), so it's a clean mid-wall doorway
      expect(horiz !== vert).toBe(true);
    }
  });
});

describe('stage-bsp-carve with halls', () => {
  const hallCfg = { width: 60, height: 44, minRoomSize: 6, includeHalls: true, hallWidth: 1 };

  it('leaves the entire map floor-connected through halls and doors', () => {
    const { level } = build(hallCfg, {}, 3);
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
  });

  it('floors every hall strip', () => {
    const { level } = build(hallCfg, {}, 5);
    for (const hall of level.blackboard[LEVEL_BSP].halls) {
      for (let y = hall.y0; y <= hall.y1; y++)
        for (let x = hall.x0; x <= hall.x1; x++) expect(level.tiles[y][x]).toBe('floor');
    }
  });

  it('doors only the room exits, never the hall-to-hall gaps', () => {
    const { level } = build(hallCfg, {}, 5);
    const eligible = level.blackboard[LEVEL_BSP].connections.filter((c) => c.door);
    expect(doors(level).length).toBe(eligible.length);
    // hall-to-hall connections carry no rooms and get no door
    const hallGaps = level.blackboard[LEVEL_BSP].connections.filter((c) => !c.door);
    const doorKeys = new Set(
      doors(level).map(
        (d) => `${d.components.get('position').x},${d.components.get('position').y}`,
      ),
    );
    for (const c of hallGaps) expect(doorKeys.has(`${c.gap[0]},${c.gap[1]}`)).toBe(false);
  });

  it('supports a 2-wide hall', () => {
    const { level } = build({ ...hallCfg, hallWidth: 2 }, {}, 8);
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
    expect(level.blackboard[LEVEL_BSP].halls.length).toBeGreaterThan(0);
  });

  it('stays fully connected with hall loops opened', () => {
    const { level } = build({ ...hallCfg, hallLoopChance: 1 }, {}, 7);
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
  });

  it('stays fully connected with leaf-hall suites', () => {
    const { level } = build({ ...hallCfg, skipLeafHalls: true }, {}, 7);
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
  });

  it('supports a 2-wide hall with suites and loops together', () => {
    const { level } = build(
      { ...hallCfg, hallWidth: 2, skipLeafHalls: true, hallLoopChance: 0.5 },
      {},
      2,
    );
    expect(connectedFloorCount(level)).toBe(totalFloor(level));
  });
});
