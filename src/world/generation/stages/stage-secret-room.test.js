import { describe, it, expect } from 'vitest';
import { run as runSecretRoom } from './stage-secret-room.js';
import { createLevel } from '../../map/level.js';
import { createEntityRegistry } from '../../../engine/core/entity-component-system.js';
import { createRng } from '../../../engine/core/rng.js';
import { isFloorTile, tileCategory } from '../../map/tile-registry.js';

// '#' wall, '.' floor.
function build(rows) {
  const registry = createEntityRegistry();
  const level = createLevel();
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map((r) => [...r].map((c) => (c === '#' ? 'wall' : 'floor')));
  return { level, registry };
}

const secretsOf = (r) => r.getEntitiesWith('secret');
const chestsOf = (r) => r.getEntitiesWith('container');

// A floor pocket wrapped in 3-thick rock — the door wall plus the 2×3 block behind it fits on any side.
const FIELD = [
  '###########',
  '###########',
  '###########',
  '###.....###',
  '###.....###',
  '###.....###',
  '###########',
  '###########',
  '###########',
];

// A floor pocket with only 1-thick walls: the 2×3 rock block never fits, so nothing can be placed.
const THIN = ['#######', '#.....#', '#.....#', '#######'];

const ortho = (x, y) => [
  [x - 1, y],
  [x + 1, y],
  [x, y - 1],
  [x, y + 1],
];

describe('secret-room stage', () => {
  it('places a sealed one-tile room: secret door onto floor, chest behind, walls all around', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, {}, level.blackboard, createRng(1), registry);

    expect(secretsOf(registry)).toHaveLength(1);
    expect(chestsOf(registry)).toHaveLength(1);

    const door = secretsOf(registry)[0].components.get('position');
    const chest = chestsOf(registry)[0].components.get('position');

    // The door tile stays wall (disguised); its neighbours are exactly one existing floor (the opening),
    // one carved room floor (the chest), and two flanking walls.
    expect(tileCategory(level.getTile(door.x, door.y))).toBe('wall');
    const floors = ortho(door.x, door.y).filter(([x, y]) => isFloorTile(level.getTile(x, y)));
    expect(floors).toHaveLength(2);

    // The chest sits inward of the door on carved floor, enclosed on its other three sides by wall.
    expect(isFloorTile(level.getTile(chest.x, chest.y))).toBe(true);
    const chestWalls = ortho(chest.x, chest.y).filter(
      ([x, y]) => !(x === door.x && y === door.y) && tileCategory(level.getTile(x, y)) === 'wall',
    );
    expect(chestWalls).toHaveLength(3);
    // Door and chest are orthogonally adjacent.
    expect(Math.abs(door.x - chest.x) + Math.abs(door.y - chest.y)).toBe(1);
  });

  it('reveals to a floor matching the floor the door opens onto', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, {}, level.blackboard, createRng(1), registry);
    const secret = secretsOf(registry)[0];
    const d = secret.components.get('position');
    const opening = ortho(d.x, d.y).find(([x, y]) => isFloorTile(level.getTile(x, y)));
    expect(secret.components.get('secret').revealFloor).toBe(level.getTile(opening[0], opening[1]));
  });

  it('stocks the chest with the default loot (healing potion + bread)', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, {}, level.blackboard, createRng(1), registry);
    const items = chestsOf(registry)[0].components.get('inventory').items;
    const names = items.map((i) => i.components.get('entityTypeId')).sort();
    expect(names).toEqual(['bread', 'healingPotion']);
  });

  it('honors custom chest contents', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, { contents: ['dagger'] }, level.blackboard, createRng(1), registry);
    const items = chestsOf(registry)[0].components.get('inventory').items;
    expect(items.map((i) => i.components.get('entityTypeId'))).toEqual(['dagger']);
  });

  it('places nothing when no 2×3 rock block backs any wall', () => {
    const { level, registry } = build(THIN);
    runSecretRoom(level, {}, level.blackboard, createRng(1), registry);
    expect(secretsOf(registry)).toHaveLength(0);
    expect(chestsOf(registry)).toHaveLength(0);
  });

  it('places multiple non-overlapping rooms when asked', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, { count: 2 }, level.blackboard, createRng(3), registry);
    const doors = secretsOf(registry).map((s) => s.components.get('position'));
    expect(doors).toHaveLength(2);
    expect(chestsOf(registry)).toHaveLength(2);
    expect(`${doors[0].x},${doors[0].y}`).not.toBe(`${doors[1].x},${doors[1].y}`);
  });

  it('is a no-op at count 0', () => {
    const { level, registry } = build(FIELD);
    runSecretRoom(level, { count: 0 }, level.blackboard, createRng(1), registry);
    expect(secretsOf(registry)).toHaveLength(0);
  });

  it('confines the secret door to bounds', () => {
    const { level, registry } = build(FIELD);
    const bounds = { x: 0, y: 0, w: 6, h: 11 }; // left half only
    runSecretRoom(level, { bounds }, level.blackboard, createRng(1), registry);
    const d = secretsOf(registry)[0].components.get('position');
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(d.x).toBeLessThan(6);
  });

  it('is deterministic for a given seed', () => {
    const place = () => {
      const { level, registry } = build(FIELD);
      runSecretRoom(level, { count: 2 }, level.blackboard, createRng(9), registry);
      return secretsOf(registry)
        .map((s) => {
          const p = s.components.get('position');
          return `${p.x},${p.y}`;
        })
        .sort();
    };
    expect(place()).toEqual(place());
  });
});
