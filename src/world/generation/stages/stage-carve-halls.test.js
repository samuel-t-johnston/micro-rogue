import { describe, it, expect } from 'vitest';
import { run as runRoomGridGeometry } from './stage-room-grid-geometry.js';
import { run as runLink } from './stage-link.js';
import { run as runCarveRooms } from './stage-carve-rooms.js';
import { run as runCarveHalls } from './stage-carve-halls.js';
import { createLevel } from '../../level.js';
import { createEntityRegistry } from '../../../engine/entity-component-system.js';
import { createRng } from '../../../engine/rng.js';

function generate(seed = 1) {
  const level = createLevel();
  const reg = createEntityRegistry();
  const bb = level.blackboard;
  runRoomGridGeometry(level, {}, bb, createRng(seed));
  runLink(level, {}, bb, createRng(seed));
  runCarveRooms(level, {}, bb, createRng(seed));
  runCarveHalls(level, {}, bb, createRng(seed), reg);
  return { level, bb, reg };
}

function floorComponents(level) {
  const floor = new Set();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) if (level.tiles[y][x] === 'floor') floor.add(`${x},${y}`);
  }
  const seen = new Set();
  let components = 0;
  for (const start of floor) {
    if (seen.has(start)) continue;
    components++;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (floor.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
      }
    }
  }
  return components;
}

describe('carve-halls stage', () => {
  it('connects every room into a single floor component', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { level } = generate(seed);
      expect(floorComponents(level)).toBe(1);
    }
  });

  it('places one door per link, each on a floor tile', () => {
    const { level, bb, reg } = generate(3);
    const doors = reg.getEntitiesWith('openable');
    expect(doors).toHaveLength(bb['level:links'].length);
    for (const d of doors) {
      const pos = d.components.get('position');
      expect(level.tiles[pos.y][pos.x]).toBe('floor');
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generate(9);
    const b = generate(9);
    expect(a.level.tiles).toEqual(b.level.tiles);
    const doorPos = (g) => g.reg.getEntitiesWith('openable')
      .map(d => d.components.get('position')).map(p => `${p.x},${p.y}`).sort();
    expect(doorPos(a)).toEqual(doorPos(b));
  });
});
